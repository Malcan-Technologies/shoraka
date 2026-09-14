jest.mock("../../../lib/audit", () => ({
  ...jest.requireActual<typeof import("../../../lib/audit")>("../../../lib/audit"),
  createNoteEventRow: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../lib/email/ses-client", () => ({
  sendEmailWithAttachments: jest.fn().mockResolvedValue({ messageId: "msg-1" }),
}));

jest.mock("../../../lib/s3/client", () => ({
  putS3ObjectBuffer: jest.fn().mockResolvedValue(undefined),
  getS3ObjectBuffer: jest.fn().mockResolvedValue(Buffer.from("pdf")),
}));

jest.mock("../../notification/org-member-recipients", () => ({
  listIssuerOrgMemberUserIds: jest.fn(),
}));

jest.mock("./render-letter-html-to-pdf", () => ({
  renderServicingLetterHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")),
}));

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    user: { findMany: jest.fn() },
    noteServicingLetter: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    noteEvent: {
      findFirst: jest.fn(),
    },
  },
}));

import { NoteServicingLetterTrigger, NoteServicingLetterType } from "@prisma/client";
import { createNoteEventRow } from "../../../lib/audit";
import { sendEmailWithAttachments } from "../../../lib/email/ses-client";
import { prisma } from "../../../lib/prisma";
import { listIssuerOrgMemberUserIds } from "../../notification/org-member-recipients";
import { generateAndSendServicingLetter, resendServicingLetter, ensureServicingLetterAudit } from "./service";

const actor = {
  userId: "SYS",
  role: "SYSTEM",
  correlationId: "cron:note-servicing-status",
};

const letterInput = {
  noteId: "note-1",
  kind: "ARREARS" as const,
  triggeredBy: "SYSTEM" as const,
  actor,
  issuerName: "Acme",
  noteReference: "NOTE-1",
  issuerOrganizationId: "org-1",
  dueDate: new Date("2026-01-01T00:00:00.000Z"),
  daysPastDue: 21,
  outstandingTotal: 10_000,
  indicativeTawidhAmount: 10,
  indicativeGharamahAmount: 40,
  gracePeriodDays: 7,
  arrearsThresholdDays: 14,
};

describe("servicing letter audit trail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.noteServicingLetter.create as jest.Mock).mockResolvedValue({
      id: "letter-1",
    });
    (prisma.noteEvent.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it("writes NOTE_LETTER_SENT when the arrears notice is emailed", async () => {
    (listIssuerOrgMemberUserIds as jest.Mock).mockResolvedValue(["user-1"]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ email: "issuer@example.com" }]);

    await generateAndSendServicingLetter(letterInput);

    expect(sendEmailWithAttachments).toHaveBeenCalledTimes(1);
    expect(createNoteEventRow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        noteId: "note-1",
        eventType: "NOTE_LETTER_SENT",
        actorUserId: "SYS",
        metadata: expect.objectContaining({
          letterId: "letter-1",
          kind: "ARREARS",
          triggeredBy: "SYSTEM",
          delivered: true,
          recipientCount: 1,
        }),
        context: expect.objectContaining({
          actorType: "SYSTEM",
          source: "SYSTEM_JOB",
        }),
      })
    );
  });

  it("does not stamp admin letter sends as a system job", async () => {
    (listIssuerOrgMemberUserIds as jest.Mock).mockResolvedValue(["user-1"]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ email: "issuer@example.com" }]);

    await generateAndSendServicingLetter({
      ...letterInput,
      triggeredBy: "ADMIN",
      actor: { userId: "admin-1", role: "ADMIN", portal: "ADMIN" },
    });

    const params = (createNoteEventRow as jest.Mock).mock.calls[0]?.[1] as {
      source?: string;
      context?: { source?: string; actorType?: string };
    };
    expect(params.source).not.toBe("SYSTEM_JOB");
    expect(params.context).toBeUndefined();
  });

  it("still writes a timeline event when the letter is generated without recipients", async () => {
    (listIssuerOrgMemberUserIds as jest.Mock).mockResolvedValue([]);

    await generateAndSendServicingLetter(letterInput);

    expect(sendEmailWithAttachments).not.toHaveBeenCalled();
    expect(createNoteEventRow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: "NOTE_LETTER_SENT",
        metadata: expect.objectContaining({
          delivered: false,
          recipientCount: 0,
        }),
      })
    );
  });

  it("persists the unsent letter before email so a failed send can be retried", async () => {
    (listIssuerOrgMemberUserIds as jest.Mock).mockResolvedValue(["user-1"]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ email: "issuer@example.com" }]);
    (sendEmailWithAttachments as jest.Mock).mockRejectedValueOnce(new Error("SES unavailable"));

    await expect(generateAndSendServicingLetter(letterInput)).rejects.toThrow("SES unavailable");

    expect(prisma.noteServicingLetter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        note_id: "note-1",
        sent_at: null,
        sent_to: [],
      }),
    });
    expect(prisma.noteServicingLetter.update).not.toHaveBeenCalled();
    expect(createNoteEventRow).not.toHaveBeenCalled();
  });

  it("writes a resent NOTE_LETTER_SENT only after a successful email", async () => {
    (prisma.noteServicingLetter.findFirst as jest.Mock).mockResolvedValue({
      id: "letter-1",
      note_id: "note-1",
      type: NoteServicingLetterType.ARREARS,
      s3_key: "note-letters/note-1/arrears.pdf",
      triggered_by: NoteServicingLetterTrigger.SYSTEM,
      note: { issuer_organization_id: "org-1", note_reference: "NOTE-1" },
    });
    (listIssuerOrgMemberUserIds as jest.Mock).mockResolvedValue(["user-1"]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ email: "issuer@example.com" }]);

    await resendServicingLetter({
      letterId: "letter-1",
      noteId: "note-1",
      actor,
      triggeredBy: "SYSTEM",
    });

    expect(createNoteEventRow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: "NOTE_LETTER_SENT",
        metadata: expect.objectContaining({
          resent: true,
          delivered: true,
          triggeredBy: "SYSTEM",
        }),
      })
    );
  });

  it("does not claim a send when resend still has no recipients", async () => {
    (prisma.noteServicingLetter.findFirst as jest.Mock).mockResolvedValue({
      id: "letter-1",
      note_id: "note-1",
      type: NoteServicingLetterType.ARREARS,
      s3_key: "note-letters/note-1/arrears.pdf",
      triggered_by: NoteServicingLetterTrigger.SYSTEM,
      note: { issuer_organization_id: "org-1", note_reference: "NOTE-1" },
    });
    (listIssuerOrgMemberUserIds as jest.Mock).mockResolvedValue([]);

    await resendServicingLetter({
      letterId: "letter-1",
      noteId: "note-1",
      actor,
      triggeredBy: "SYSTEM",
    });

    expect(sendEmailWithAttachments).not.toHaveBeenCalled();
    expect(createNoteEventRow).not.toHaveBeenCalled();
  });

  it("rejects admin resend when there are no issuer recipients", async () => {
    (prisma.noteServicingLetter.findFirst as jest.Mock).mockResolvedValue({
      id: "letter-1",
      note_id: "note-1",
      type: NoteServicingLetterType.ARREARS,
      s3_key: "note-letters/note-1/arrears.pdf",
      triggered_by: NoteServicingLetterTrigger.ADMIN,
      note: { issuer_organization_id: "org-1", note_reference: "NOTE-1" },
    });
    (listIssuerOrgMemberUserIds as jest.Mock).mockResolvedValue([]);

    await expect(
      resendServicingLetter({
        letterId: "letter-1",
        noteId: "note-1",
        actor: { userId: "admin-1", role: "ADMIN", portal: "ADMIN" },
        triggeredBy: "ADMIN",
      })
    ).rejects.toThrow("LETTER_RECIPIENTS_MISSING");
    expect(createNoteEventRow).not.toHaveBeenCalled();
    expect(prisma.noteServicingLetter.update).not.toHaveBeenCalled();
  });

  it("keeps sent_at after a successful email when the audit write fails", async () => {
    (listIssuerOrgMemberUserIds as jest.Mock).mockResolvedValue(["user-1"]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ email: "issuer@example.com" }]);
    (createNoteEventRow as jest.Mock).mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(generateAndSendServicingLetter(letterInput)).resolves.toEqual({
      id: "letter-1",
      s3Key: expect.stringContaining("note-letters/note-1/arrears-"),
      sentTo: ["issuer@example.com"],
    });
    expect(prisma.noteServicingLetter.update).toHaveBeenCalledWith({
      where: { id: "letter-1" },
      data: { sent_at: expect.any(Date), sent_to: ["issuer@example.com"] },
    });
  });

  it("retries a missing letter audit without sending again", async () => {
    await expect(
      ensureServicingLetterAudit({
        noteId: "note-1",
        letter: {
          id: "letter-1",
          type: NoteServicingLetterType.ARREARS,
          s3_key: "note-letters/note-1/arrears.pdf",
          sent_to: ["issuer@example.com"],
        },
        actor,
        triggeredBy: "SYSTEM",
      })
    ).resolves.toBe(true);
    expect(createNoteEventRow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: "NOTE_LETTER_SENT",
        metadata: expect.objectContaining({
          letterId: "letter-1",
          s3Key: "note-letters/note-1/arrears.pdf",
          delivered: true,
        }),
      })
    );
  });

  it("does not duplicate a letter audit that already exists", async () => {
    (prisma.noteEvent.findFirst as jest.Mock).mockResolvedValue({ id: "event-1" });
    await expect(
      ensureServicingLetterAudit({
        noteId: "note-1",
        letter: {
          id: "letter-1",
          type: NoteServicingLetterType.ARREARS,
          s3_key: "note-letters/note-1/arrears.pdf",
          sent_to: ["issuer@example.com"],
        },
        actor,
        triggeredBy: "SYSTEM",
      })
    ).resolves.toBe(false);
    expect(createNoteEventRow).not.toHaveBeenCalled();
  });
});
