import type { TrusteeLetterConfig } from "@cashsouk/types";
import { getS3ObjectBuffer } from "../../../lib/s3/client";
import { sendEmailWithAttachments } from "../../../lib/email/ses-client";
import { assertTrusteeAutoSendRecipients } from "./trustee-email-config";

export type TrusteeInstructionEmailKind =
  | "ISSUER_DISBURSEMENT"
  | "INVESTOR_WITHDRAWAL"
  | "ISSUER_RESIDUAL_RETURN"
  | "ADMIN_ADJUSTMENT"
  | "SETTLEMENT";

const PURPOSE_LABELS: Record<TrusteeInstructionEmailKind, string> = {
  ISSUER_DISBURSEMENT: "Issuer disbursement",
  INVESTOR_WITHDRAWAL: "Investor withdrawal",
  ISSUER_RESIDUAL_RETURN: "Issuer residual return",
  ADMIN_ADJUSTMENT: "Admin adjustment",
  SETTLEMENT: "Settlement trustee instruction",
};

export function escapeTrusteeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function trusteeInstructionPurposeLabel(kind: TrusteeInstructionEmailKind): string {
  return PURPOSE_LABELS[kind];
}

export function safeTrusteePdfFilename(reference: string, kind: TrusteeInstructionEmailKind): string {
  const slug = reference
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const purpose = kind.toLowerCase().replace(/_/g, "-");
  return `trustee-${purpose}-${slug || "instruction"}.pdf`;
}

export function buildTrusteeInstructionEmailContent(input: {
  kind: TrusteeInstructionEmailKind;
  reference: string;
  platformDisplayName?: string;
}): { subject: string; html: string; text: string } {
  const purpose = trusteeInstructionPurposeLabel(input.kind);
  const reference = input.reference.trim() || "unspecified";
  const sender = input.platformDisplayName?.trim() || "CashSouk";
  const subject = `Trustee instruction — ${purpose} — ${reference}`;
  const text = [
    "Dear Trustee,",
    "",
    "Please find attached the signed trustee payment instruction.",
    "",
    `Purpose: ${purpose}`,
    `Reference: ${reference}`,
    "",
    "Please process this instruction in accordance with the attached letter.",
    "",
    "Regards,",
    sender,
  ].join("\n");
  const html = [
    "<p>Dear Trustee,</p>",
    "<p>Please find attached the signed trustee payment instruction.</p>",
    `<p>Purpose: ${escapeTrusteeEmailHtml(purpose)}<br/>Reference: ${escapeTrusteeEmailHtml(reference)}</p>`,
    "<p>Please process this instruction in accordance with the attached letter.</p>",
    `<p>Regards,<br/>${escapeTrusteeEmailHtml(sender)}</p>`,
  ].join("");
  return { subject, html, text };
}

export function extractLatestSettlementTrusteeLetterS3Key(
  events: Array<{ metadata?: unknown | null; createdAt?: string | Date }>,
  settlementId: string
): string | null {
  const matching = events
    .map((event) => {
      const metadata =
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>)
          : null;
      const eventSettlementId = typeof metadata?.settlementId === "string" ? metadata.settlementId : null;
      const s3Key = typeof metadata?.s3Key === "string" ? metadata.s3Key.trim() : "";
      const createdAt =
        event.createdAt instanceof Date
          ? event.createdAt.getTime()
          : event.createdAt
            ? new Date(event.createdAt).getTime()
            : 0;
      return { eventSettlementId, s3Key, createdAt };
    })
    .filter((event) => event.eventSettlementId === settlementId && event.s3Key.length > 0)
    .sort((left, right) => right.createdAt - left.createdAt);
  return matching[0]?.s3Key ?? null;
}

export async function sendTrusteeInstructionPdfEmail(input: {
  kind: TrusteeInstructionEmailKind;
  reference: string;
  s3Key: string;
  config: TrusteeLetterConfig;
}): Promise<{ messageId: string }> {
  const recipients = assertTrusteeAutoSendRecipients(input.config);
  const content = buildTrusteeInstructionEmailContent({
    kind: input.kind,
    reference: input.reference,
    platformDisplayName: input.config.platformDisplayName,
  });
  const pdf = await getS3ObjectBuffer(input.s3Key);
  return sendEmailWithAttachments({
    to: recipients.to,
    cc: recipients.cc.length > 0 ? recipients.cc : undefined,
    subject: content.subject,
    html: content.html,
    text: content.text,
    attachments: [
      {
        filename: safeTrusteePdfFilename(input.reference, input.kind),
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
}
