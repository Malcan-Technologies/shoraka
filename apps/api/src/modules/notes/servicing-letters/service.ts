import {
  NoteServicingLetterTrigger,
  NoteServicingLetterType,
  Prisma,
} from "@prisma/client";
import { createNoteEventRow, systemAuditContext, type AuditRequestContext } from "../../../lib/audit";
import { sendEmailWithAttachments } from "../../../lib/email/ses-client";
import { logger } from "../../../lib/logger";
import { prisma } from "../../../lib/prisma";
import { getS3ObjectBuffer, putS3ObjectBuffer } from "../../../lib/s3/client";
import { listIssuerOrgMemberUserIds } from "../../notification/org-member-recipients";
import { resolveNoteEventTarget } from "../audit-fields";
import {
  buildServicingLetterHtml,
  servicingLetterTitle,
  type ServicingLetterKind,
} from "./letter-html-template";
import { renderServicingLetterHtmlToPdf } from "./render-letter-html-to-pdf";

export type ServicingLetterActor = {
  userId: string;
  role?: string;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  auditContext?: AuditRequestContext;
};

export type ServicingLetterInput = {
  noteId: string;
  kind: ServicingLetterKind;
  triggeredBy: "SYSTEM" | "ADMIN";
  actor: ServicingLetterActor;
  issuerName: string;
  noteReference: string;
  issuerOrganizationId: string;
  dueDate: Date | null;
  daysPastDue: number;
  outstandingTotal: number;
  indicativeTawidhAmount: number;
  indicativeGharamahAmount: number;
  gracePeriodDays: number;
  arrearsThresholdDays: number;
  defaultDate?: Date | null;
  defaultReason?: string | null;
};

function moneyLabel(amount: number): string {
  return `MYR ${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

function letterType(kind: ServicingLetterKind): NoteServicingLetterType {
  return kind === "DEFAULT" ? NoteServicingLetterType.DEFAULT : NoteServicingLetterType.ARREARS;
}

async function issuerEmails(issuerOrganizationId: string): Promise<string[]> {
  const userIds = await listIssuerOrgMemberUserIds(issuerOrganizationId);
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { user_id: { in: userIds } },
    select: { email: true },
  });
  return [...new Set(users.map((user) => user.email).filter(Boolean))];
}

export async function generateAndSendServicingLetter(
  input: ServicingLetterInput
): Promise<{ id: string; s3Key: string; sentTo: string[] }> {
  const html = buildServicingLetterHtml({
    kind: input.kind,
    noteReference: input.noteReference,
    issuerName: input.issuerName,
    dueDateLabel: dateLabel(input.dueDate),
    daysPastDue: input.daysPastDue,
    outstandingTotalLabel: moneyLabel(input.outstandingTotal),
    indicativeTawidhLabel: moneyLabel(input.indicativeTawidhAmount),
    indicativeGharamahLabel: moneyLabel(input.indicativeGharamahAmount),
    gracePeriodDays: input.gracePeriodDays,
    arrearsThresholdDays: input.arrearsThresholdDays,
    generatedAtLabel: dateLabel(new Date()),
    defaultDateLabel: dateLabel(input.defaultDate ?? null),
    defaultReason: input.defaultReason ?? null,
  });
  const buffer = await renderServicingLetterHtmlToPdf(html);
  const s3Key = `note-letters/${input.noteId}/${input.kind.toLowerCase()}-${Date.now()}.pdf`;
  await putS3ObjectBuffer({ key: s3Key, body: buffer, contentType: "application/pdf" });

  const sentTo = await issuerEmails(input.issuerOrganizationId);
  const title = servicingLetterTitle(input.kind);
  if (sentTo.length > 0) {
    await sendEmailWithAttachments({
      to: sentTo,
      subject: `${title} — ${input.noteReference}`,
      html: `<p>Please find attached the ${title.toLowerCase()} for note ${input.noteReference}.</p>`,
      text: `Please find attached the ${title.toLowerCase()} for note ${input.noteReference}.`,
      attachments: [
        {
          filename: `${input.kind.toLowerCase()}-notice-${input.noteReference}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });
  } else {
    logger.warn({ noteId: input.noteId }, "Servicing letter generated with no issuer email recipients");
  }

  const letter = await prisma.noteServicingLetter.create({
    data: {
      note_id: input.noteId,
      type: letterType(input.kind),
      s3_key: s3Key,
      sent_at: sentTo.length > 0 ? new Date() : null,
      sent_to: sentTo,
      triggered_by:
        input.triggeredBy === "ADMIN"
          ? NoteServicingLetterTrigger.ADMIN
          : NoteServicingLetterTrigger.SYSTEM,
    },
  });

  const metadata: Prisma.InputJsonValue = {
    letterId: letter.id,
    s3Key,
    kind: input.kind,
    sentTo,
    triggeredBy: input.triggeredBy,
  };
  const target = resolveNoteEventTarget("NOTE_LETTER_SENT", metadata);
  await createNoteEventRow(prisma, {
    noteId: input.noteId,
    eventType: "NOTE_LETTER_SENT",
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    portal: input.actor.portal,
    ipAddress: input.actor.ipAddress,
    userAgent: input.actor.userAgent,
    correlationId: input.actor.correlationId,
    context:
      input.actor.auditContext ??
      systemAuditContext({
        actorUserId: input.actor.userId,
        correlationId: input.actor.correlationId,
      }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? input.noteId,
  });

  return { id: letter.id, s3Key, sentTo };
}

export async function resendServicingLetter(input: {
  letterId: string;
  noteId: string;
  actor: ServicingLetterActor;
}): Promise<{ s3Key: string; sentTo: string[] }> {
  const letter = await prisma.noteServicingLetter.findFirst({
    where: { id: input.letterId, note_id: input.noteId },
    include: { note: { select: { issuer_organization_id: true, note_reference: true } } },
  });
  if (!letter) {
    throw new Error("LETTER_NOT_FOUND");
  }
  const pdf = await getS3ObjectBuffer(letter.s3_key);
  const sentTo = await issuerEmails(letter.note.issuer_organization_id);
  const kind = letter.type === NoteServicingLetterType.DEFAULT ? "DEFAULT" : "ARREARS";
  const title = servicingLetterTitle(kind);
  if (sentTo.length > 0) {
    await sendEmailWithAttachments({
      to: sentTo,
      subject: `${title} — ${letter.note.note_reference}`,
      html: `<p>Please find attached the ${title.toLowerCase()} for note ${letter.note.note_reference}.</p>`,
      text: `Please find attached the ${title.toLowerCase()} for note ${letter.note.note_reference}.`,
      attachments: [
        {
          filename: `${kind.toLowerCase()}-notice-${letter.note.note_reference}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
  }
  await prisma.noteServicingLetter.update({
    where: { id: letter.id },
    data:
      sentTo.length > 0
        ? { sent_at: new Date(), sent_to: sentTo }
        : { sent_at: letter.sent_at ?? new Date() },
  });
  const metadata: Prisma.InputJsonValue = {
    letterId: letter.id,
    s3Key: letter.s3_key,
    kind,
    sentTo,
    triggeredBy: "ADMIN",
    resent: true,
  };
  const target = resolveNoteEventTarget("NOTE_LETTER_SENT", metadata);
  await createNoteEventRow(prisma, {
    noteId: input.noteId,
    eventType: "NOTE_LETTER_SENT",
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    portal: input.actor.portal,
    ipAddress: input.actor.ipAddress,
    userAgent: input.actor.userAgent,
    correlationId: input.actor.correlationId,
    context: input.actor.auditContext,
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? input.noteId,
  });
  return { s3Key: letter.s3_key, sentTo };
}
