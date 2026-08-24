jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(() => ({ id: "note-1" })),
}));

jest.mock("./trustee-letters/trustee-instruction-email", () => ({
  ...jest.requireActual<typeof import("./trustee-letters/trustee-instruction-email")>(
    "./trustee-letters/trustee-instruction-email"
  ),
  sendTrusteeInstructionPdfEmail: jest.fn(),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    withdrawalInstruction: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    noteSettlement: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    noteEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: {
    findById: jest.fn(),
  },
}));

jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

import { NoteSettlementStatus, ServiceFeeTrusteeInstructionStatus, WithdrawalStatus, WithdrawalType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NoteService } from "./service";
import { sendTrusteeInstructionPdfEmail } from "./trustee-letters/trustee-instruction-email";

describe("trustee instruction submit email wiring", () => {
  const service = new NoteService();
  const actor = { userId: "admin-1", role: "ADMIN" as const, portal: "ADMIN" as const };
  const autoSendConfig = {
    trusteeName: "RHB Trustees Berhad",
    trusteeAddressLine1: "Level 11",
    trusteeAddressLine2: "Jalan Tun Razak",
    attentionPerson: "Ms Lim",
    defaultContactPerson: "CashSouk Finance Team",
    authorisedSignatoryLabel: "Authorised Signatories",
    platformDisplayName: "CashSouk Sdn Bhd",
    autoSendTrusteeEmail: true,
    trusteeEmail: "trustee@example.com",
  };

  const withdrawalRow = {
    id: "wd-1",
    note_id: "note-1",
    display_reference: "WD-1",
    letter_s3_key: "withdrawal-letters/wd-1/letter.pdf",
    withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
    status: WithdrawalStatus.LETTER_GENERATED,
    trustee_email_sent_at: null as Date | null,
  };

  const settlementRow = {
    id: "set-1",
    note_id: "note-1",
    display_reference: "STL-1",
    status: NoteSettlementStatus.POSTED,
    investor_principal: 100,
    investor_profit_net: 0,
    tawidh_investor_amount: 0,
    service_fee_amount: 10,
    tawidh_account_amount: 0,
    gharamah_amount: 0,
    issuer_residual_amount: 0,
    service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED,
    service_fee_trustee_submitted_at: null,
    service_fee_trustee_email_sent_at: null as Date | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
      trusteeLetterConfig: { autoSendTrusteeEmail: false },
    } as never);
    jest.spyOn(service as unknown as { mapWithdrawal: (row: unknown) => unknown }, "mapWithdrawal").mockImplementation(
      (row) => row
    );
    jest.spyOn(service, "getAdminNoteDetail").mockResolvedValue({ id: "note-1" } as never);
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma)
    );
    (prisma.withdrawalInstruction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.withdrawalInstruction.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...withdrawalRow,
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
    });
    (prisma.noteSettlement.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.noteEvent.create as jest.Mock).mockResolvedValue({});
    (prisma.noteEvent.findMany as jest.Mock).mockResolvedValue([
      {
        metadata: { settlementId: "set-1", s3Key: "note-letters/n1/letter.pdf" },
        created_at: new Date("2026-08-24T12:00:00.000Z"),
      },
    ]);
    (sendTrusteeInstructionPdfEmail as jest.Mock).mockResolvedValue({ messageId: "ses-1" });
  });

  describe("markWithdrawalSubmitted", () => {
    it("keeps status-only behavior when auto-send is off", async () => {
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(withdrawalRow);

      await expect(service.markWithdrawalSubmitted("wd-1", actor)).resolves.toMatchObject({
        id: "wd-1",
      });
      expect(sendTrusteeInstructionPdfEmail).not.toHaveBeenCalled();
      expect(prisma.withdrawalInstruction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd-1", status: WithdrawalStatus.LETTER_GENERATED },
        })
      );
    });

    it("sends the letter, persists sent-at, then marks submitted", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: autoSendConfig,
      } as never);
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(withdrawalRow);

      await service.markWithdrawalSubmitted("wd-1", actor);

      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalledWith({
        kind: WithdrawalType.ISSUER_DISBURSEMENT,
        reference: "WD-1",
        s3Key: "withdrawal-letters/wd-1/letter.pdf",
        config: autoSendConfig,
      });
      expect(prisma.withdrawalInstruction.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: "wd-1", trustee_email_sent_at: null },
          data: { trustee_email_sent_at: expect.any(Date) },
        })
      );
      expect(prisma.noteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "WITHDRAWAL_TRUSTEE_EMAIL_SENT",
            metadata: { withdrawalId: "wd-1", messageId: "ses-1" },
          }),
        })
      );
      expect(prisma.withdrawalInstruction.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: "wd-1", status: WithdrawalStatus.LETTER_GENERATED },
        })
      );
    });

    it("blocks the status change when SES fails", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: autoSendConfig,
      } as never);
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(withdrawalRow);
      (sendTrusteeInstructionPdfEmail as jest.Mock).mockRejectedValue(new Error("SES down"));

      await expect(service.markWithdrawalSubmitted("wd-1", actor)).rejects.toThrow("SES down");
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.withdrawalInstruction.updateMany).not.toHaveBeenCalled();
    });

    it("skips resend when sent-at is already populated", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: autoSendConfig,
      } as never);
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
        ...withdrawalRow,
        trustee_email_sent_at: new Date("2026-08-24T10:00:00.000Z"),
      });

      await service.markWithdrawalSubmitted("wd-1", actor);

      expect(sendTrusteeInstructionPdfEmail).not.toHaveBeenCalled();
      expect(prisma.withdrawalInstruction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd-1", status: WithdrawalStatus.LETTER_GENERATED },
        })
      );
    });
  });

  describe("markServiceFeeTrusteeLetterSubmitted", () => {
    it("keeps status-only behavior when auto-send is off", async () => {
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(settlementRow);

      await expect(
        service.markServiceFeeTrusteeLetterSubmitted("note-1", "set-1", actor)
      ).resolves.toMatchObject({ id: "note-1" });
      expect(sendTrusteeInstructionPdfEmail).not.toHaveBeenCalled();
      expect(prisma.noteSettlement.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "set-1",
            note_id: "note-1",
            service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED,
          },
        })
      );
    });

    it("sends the letter, persists sent-at, then marks submitted", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: autoSendConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(settlementRow);

      await service.markServiceFeeTrusteeLetterSubmitted("note-1", "set-1", actor);

      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalledWith({
        kind: "SERVICE_FEE",
        reference: "STL-1",
        s3Key: "note-letters/n1/letter.pdf",
        config: autoSendConfig,
      });
      expect(prisma.noteSettlement.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: "set-1", note_id: "note-1", service_fee_trustee_email_sent_at: null },
        })
      );
      expect(prisma.noteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "SERVICE_FEE_TRUSTEE_EMAIL_SENT",
            metadata: { settlementId: "set-1", messageId: "ses-1" },
          }),
        })
      );
    });

    it("blocks the status change when SES fails", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: autoSendConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(settlementRow);
      (sendTrusteeInstructionPdfEmail as jest.Mock).mockRejectedValue(new Error("SES down"));

      await expect(
        service.markServiceFeeTrusteeLetterSubmitted("note-1", "set-1", actor)
      ).rejects.toThrow("SES down");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("skips resend when sent-at is already populated", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: autoSendConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...settlementRow,
        service_fee_trustee_email_sent_at: new Date("2026-08-24T10:00:00.000Z"),
      });

      await service.markServiceFeeTrusteeLetterSubmitted("note-1", "set-1", actor);

      expect(sendTrusteeInstructionPdfEmail).not.toHaveBeenCalled();
      expect(prisma.noteSettlement.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "set-1",
            note_id: "note-1",
            service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED,
          },
        })
      );
    });

    it("fails before status mutation when the settlement PDF key is missing", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: autoSendConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(settlementRow);
      (prisma.noteEvent.findMany as jest.Mock).mockResolvedValue([
        {
          metadata: { settlementId: "set-other", s3Key: "other.pdf" },
          created_at: new Date(),
        },
      ]);

      await expect(
        service.markServiceFeeTrusteeLetterSubmitted("note-1", "set-1", actor)
      ).rejects.toMatchObject({ code: "SERVICE_FEE_TRUSTEE_LETTER_S3_KEY_MISSING" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("resendWithdrawalTrusteeEmail", () => {
    const submittedSent = {
      ...withdrawalRow,
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      trustee_email_sent_at: new Date("2026-08-24T10:00:00.000Z"),
    };
    const latestConfig = {
      ...autoSendConfig,
      autoSendTrusteeEmail: false,
      trusteeEmail: "new-trustee@example.com",
      trusteeCcEmails: ["ops@example.com"],
    };

    it("resends with latest recipients and PDF, updates sent-at, and leaves workflow untouched", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: latestConfig,
      } as never);
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(submittedSent);
      (prisma.withdrawalInstruction.findUniqueOrThrow as jest.Mock).mockResolvedValue(submittedSent);

      await service.resendWithdrawalTrusteeEmail("wd-1", actor);

      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalledWith({
        kind: WithdrawalType.ISSUER_DISBURSEMENT,
        reference: "WD-1",
        s3Key: "withdrawal-letters/wd-1/letter.pdf",
        config: latestConfig,
      });
      expect(prisma.withdrawalInstruction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "wd-1",
            trustee_email_sent_at: { not: null },
            status: {
              in: [WithdrawalStatus.LETTER_GENERATED, WithdrawalStatus.SUBMITTED_TO_TRUSTEE],
            },
          },
          data: { trustee_email_sent_at: expect.any(Date) },
        })
      );
      expect(prisma.withdrawalInstruction.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: expect.anything() }),
        })
      );
      expect(prisma.noteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "WITHDRAWAL_TRUSTEE_EMAIL_SENT",
            metadata: { withdrawalId: "wd-1", messageId: "ses-1", resend: true },
          }),
        })
      );
    });

    it("allows letter-generated fallback when sent-at already exists", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: latestConfig,
      } as never);
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
        ...submittedSent,
        status: WithdrawalStatus.LETTER_GENERATED,
      });
      (prisma.withdrawalInstruction.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        ...submittedSent,
        status: WithdrawalStatus.LETTER_GENERATED,
      });

      await expect(service.resendWithdrawalTrusteeEmail("wd-1", actor)).resolves.toMatchObject({
        id: "wd-1",
      });
      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalled();
    });

    it("rejects before the first email and after completed or cancelled", async () => {
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
        ...withdrawalRow,
        status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
        trustee_email_sent_at: null,
      });
      await expect(service.resendWithdrawalTrusteeEmail("wd-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_SENT",
      });

      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
        ...submittedSent,
        status: WithdrawalStatus.DRAFT,
      });
      await expect(service.resendWithdrawalTrusteeEmail("wd-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_RESENDABLE",
      });

      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
        ...submittedSent,
        status: WithdrawalStatus.COMPLETED,
      });
      await expect(service.resendWithdrawalTrusteeEmail("wd-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_RESENDABLE",
      });

      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
        ...submittedSent,
        status: WithdrawalStatus.CANCELLED,
      });
      await expect(service.resendWithdrawalTrusteeEmail("wd-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_RESENDABLE",
      });
      expect(sendTrusteeInstructionPdfEmail).not.toHaveBeenCalled();
    });

    it("leaves sent-at unchanged when SES fails", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: latestConfig,
      } as never);
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(submittedSent);
      (sendTrusteeInstructionPdfEmail as jest.Mock).mockRejectedValue(new Error("SES down"));

      await expect(service.resendWithdrawalTrusteeEmail("wd-1", actor)).rejects.toThrow("SES down");
      expect(prisma.withdrawalInstruction.updateMany).not.toHaveBeenCalled();
      expect(prisma.noteEvent.create).not.toHaveBeenCalled();
    });

    it("throws when SES accepted but workflow status changed before persist", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: latestConfig,
      } as never);
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(submittedSent);
      (prisma.withdrawalInstruction.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.resendWithdrawalTrusteeEmail("wd-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_RESEND_STATE_CHANGED",
        message: expect.stringMatching(/accepted by the mail service[\s\S]*Refresh this page/i),
      });
      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalled();
      expect(prisma.noteEvent.create).not.toHaveBeenCalled();
      expect(prisma.withdrawalInstruction.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe("resendServiceFeeTrusteeEmail", () => {
    const submittedSent = {
      ...settlementRow,
      service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE,
      service_fee_trustee_email_sent_at: new Date("2026-08-24T10:00:00.000Z"),
    };
    const latestConfig = {
      ...autoSendConfig,
      autoSendTrusteeEmail: false,
      trusteeEmail: "new-trustee@example.com",
    };

    it("resends with latest recipients and PDF, updates sent-at, and leaves workflow untouched", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: latestConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(submittedSent);

      await service.resendServiceFeeTrusteeEmail("note-1", "set-1", actor);

      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalledWith({
        kind: "SERVICE_FEE",
        reference: "STL-1",
        s3Key: "note-letters/n1/letter.pdf",
        config: latestConfig,
      });
      expect(prisma.noteSettlement.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "set-1",
            note_id: "note-1",
            service_fee_trustee_email_sent_at: { not: null },
            service_fee_trustee_status: {
              in: [
                ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED,
                ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE,
              ],
            },
          },
          data: { service_fee_trustee_email_sent_at: expect.any(Date) },
        })
      );
      expect(prisma.noteSettlement.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ service_fee_trustee_status: expect.anything() }),
        })
      );
      expect(prisma.noteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "SERVICE_FEE_TRUSTEE_EMAIL_SENT",
            metadata: { settlementId: "set-1", messageId: "ses-1", resend: true },
          }),
        })
      );
    });

    it("allows letter-generated status when sent-at already exists", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: latestConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...submittedSent,
        service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED,
      });

      await expect(service.resendServiceFeeTrusteeEmail("note-1", "set-1", actor)).resolves.toMatchObject({
        id: "note-1",
      });
      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalled();
    });

    it("rejects before the first email and after completed", async () => {
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...settlementRow,
        service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE,
        service_fee_trustee_email_sent_at: null,
      });
      await expect(service.resendServiceFeeTrusteeEmail("note-1", "set-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_SENT",
      });

      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...submittedSent,
        service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.PENDING_LETTER,
      });
      await expect(service.resendServiceFeeTrusteeEmail("note-1", "set-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_RESENDABLE",
      });

      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...submittedSent,
        service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.COMPLETED,
      });
      await expect(service.resendServiceFeeTrusteeEmail("note-1", "set-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_RESENDABLE",
      });
      expect(sendTrusteeInstructionPdfEmail).not.toHaveBeenCalled();
    });

    it("leaves sent-at unchanged when SES fails", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: latestConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(submittedSent);
      (sendTrusteeInstructionPdfEmail as jest.Mock).mockRejectedValue(new Error("SES down"));

      await expect(service.resendServiceFeeTrusteeEmail("note-1", "set-1", actor)).rejects.toThrow(
        "SES down"
      );
      expect(prisma.noteSettlement.updateMany).not.toHaveBeenCalled();
      expect(prisma.noteEvent.create).not.toHaveBeenCalled();
    });

    it("throws when SES accepted but trustee status changed before persist", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: latestConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(submittedSent);
      (prisma.noteSettlement.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.resendServiceFeeTrusteeEmail("note-1", "set-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_RESEND_STATE_CHANGED",
        message: expect.stringMatching(/accepted by the mail service[\s\S]*Refresh this page/i),
      });
      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalled();
      expect(prisma.noteEvent.create).not.toHaveBeenCalled();
      expect(service.getAdminNoteDetail).not.toHaveBeenCalled();
    });
  });
});
