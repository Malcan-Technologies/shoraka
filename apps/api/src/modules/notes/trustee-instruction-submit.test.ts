jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(() => ({ id: "note-1" })),
  mapNoteListItem: jest.fn(() => ({ paymasterName: "Paymaster Co", issuerName: "Issuer Co" })),
}));

jest.mock("./trustee-letters/trustee-letter-pdf.renderer", () => ({
  renderTrusteeLetterPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")),
}));

jest.mock("../../lib/s3/client", () => ({
  generatePresignedUploadUrl: jest.fn(),
  generatePresignedViewUrl: jest.fn(),
  getS3ObjectBuffer: jest.fn(),
  putS3ObjectBuffer: jest.fn().mockResolvedValue(undefined),
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
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    noteSettlement: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    notePayment: {
      findMany: jest.fn(),
    },
    issuerOrganization: {
      findUnique: jest.fn(),
    },
    noteEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    note: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    noteLedgerEntry: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
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

jest.mock("../notification/withdrawal-notifications", () => ({
  notifyWithdrawalSubmittedToTrustee: jest.fn().mockResolvedValue({
    skipped: false,
    attempted: 0,
    delivered: 0,
    deliveries: [],
  }),
}));

jest.mock("../notification/note-lifecycle-notifications", () => {
  const actual =
    jest.requireActual<typeof import("../notification/note-lifecycle-notifications")>(
      "../notification/note-lifecycle-notifications"
    );
  return {
    ...actual,
    notifyNoteIssuerRepaid: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("../../lib/refresh-contract-facility", () => ({
  lockContractRow: jest.fn(),
  refreshContractFacilityForNote: jest.fn(),
}));

import {
  NoteSettlementStatus,
  ServiceFeeTrusteeInstructionStatus,
  WithdrawalStatus,
  WithdrawalType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import * as noteLifecycle from "../notification/note-lifecycle-notifications";
import { noteRepository } from "./repository";
import { NoteService } from "./service";
import { sendTrusteeInstructionPdfEmail } from "./trustee-letters/trustee-instruction-email";
import { notifyWithdrawalSubmittedToTrustee } from "../notification/withdrawal-notifications";

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
    jest
      .spyOn(service as unknown as { mapWithdrawal: (row: unknown) => unknown }, "mapWithdrawal")
      .mockImplementation((row) => row);
    jest.spyOn(service, "getAdminNoteDetail").mockResolvedValue({ id: "note-1" } as never);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof prisma) => unknown) => fn(prisma)
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
      expect(notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledWith(
        expect.objectContaining({
          withdrawal: expect.objectContaining({
            id: "wd-1",
            status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
          }),
        })
      );
    });

    it("still marks submitted when the withdrawal notification helper throws", async () => {
      (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(withdrawalRow);
      (notifyWithdrawalSubmittedToTrustee as jest.Mock).mockRejectedValueOnce(
        new Error("notification failed")
      );

      await expect(service.markWithdrawalSubmitted("wd-1", actor)).resolves.toMatchObject({
        id: "wd-1",
        status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      });
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
            metadata: { withdrawalId: "wd-1", withdrawalReference: "WD-1", messageId: "ses-1" },
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

  describe("generateSettlementTrusteeLetter", () => {
    it("writes SETTLEMENT_TRUSTEE_LETTER_GENERATED and does not emit the legacy ID", async () => {
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...settlementRow,
        preview_snapshot: {},
        payment_id: null,
        gross_receipt_amount: 100,
        posted_at: new Date("2026-08-01T00:00:00.000Z"),
        service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED,
      });
      (noteRepository.findById as jest.Mock).mockResolvedValue({
        id: "note-1",
        issuer_organization_id: "org-1",
      });
      (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
        id: "org-1",
        name: "Issuer Co",
        bank_account_details: null,
      });
      (prisma.withdrawalInstruction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.notePayment.findMany as jest.Mock).mockResolvedValue([]);
      jest
        .spyOn(
          service as unknown as { resolveTrusteeSignatureImageBuffer: () => Promise<null> },
          "resolveTrusteeSignatureImageBuffer"
        )
        .mockResolvedValue(null);

      await expect(
        service.generateSettlementTrusteeLetter("note-1", "set-1", actor)
      ).resolves.toEqual({ s3Key: expect.stringContaining("note-letters/note-1/service-fee-trustee/") });

      expect(prisma.noteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "SETTLEMENT_TRUSTEE_LETTER_GENERATED",
            metadata: expect.objectContaining({
              settlementId: "set-1",
              s3Key: expect.stringContaining("note-letters/note-1/service-fee-trustee/"),
            }),
          }),
        })
      );
      expect(prisma.noteEvent.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event_type: "SERVICE_FEE_TRUSTEE_LETTER_GENERATED" }),
        })
      );
    });
  });

  describe("markSettlementTrusteeLetterSubmitted", () => {
    it("keeps status-only behavior when auto-send is off", async () => {
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(settlementRow);

      await expect(
        service.markSettlementTrusteeLetterSubmitted("note-1", "set-1", actor)
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
      expect(prisma.noteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "SETTLEMENT_TRUSTEE_LETTER_SUBMITTED",
            metadata: { settlementId: "set-1" },
          }),
        })
      );
      expect(prisma.noteEvent.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event_type: "SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED" }),
        })
      );
    });

    it("sends the letter, persists sent-at, then marks submitted", async () => {
      jest.spyOn(service, "getPlatformFinanceSettings").mockResolvedValue({
        trusteeLetterConfig: autoSendConfig,
      } as never);
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue(settlementRow);

      await service.markSettlementTrusteeLetterSubmitted("note-1", "set-1", actor);

      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalledWith({
        kind: "SERVICE_FEE",
        reference: "STL-1",
        s3Key: "note-letters/n1/letter.pdf",
        config: autoSendConfig,
      });
      expect(prisma.noteEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            note_id: "note-1",
            event_type: {
              in: ["SETTLEMENT_TRUSTEE_LETTER_GENERATED", "SERVICE_FEE_TRUSTEE_LETTER_GENERATED"],
            },
          },
        })
      );
      expect(prisma.noteSettlement.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: "set-1", note_id: "note-1", service_fee_trustee_email_sent_at: null },
        })
      );
      expect(prisma.noteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "SETTLEMENT_TRUSTEE_EMAIL_SENT",
            metadata: { settlementId: "set-1", settlementReference: "STL-1", messageId: "ses-1" },
          }),
        })
      );
      expect(prisma.noteEvent.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event_type: "SERVICE_FEE_TRUSTEE_EMAIL_SENT" }),
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
        service.markSettlementTrusteeLetterSubmitted("note-1", "set-1", actor)
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

      await service.markSettlementTrusteeLetterSubmitted("note-1", "set-1", actor);

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
        service.markSettlementTrusteeLetterSubmitted("note-1", "set-1", actor)
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
      (prisma.withdrawalInstruction.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        submittedSent
      );

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
            metadata: { withdrawalId: "wd-1", withdrawalReference: "WD-1", messageId: "ses-1", resend: true },
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

  describe("resendSettlementTrusteeEmail", () => {
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

      await service.resendSettlementTrusteeEmail("note-1", "set-1", actor);

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
            event_type: "SETTLEMENT_TRUSTEE_EMAIL_SENT",
            metadata: { settlementId: "set-1", settlementReference: "STL-1", messageId: "ses-1", resend: true },
          }),
        })
      );
      expect(prisma.noteEvent.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event_type: "SERVICE_FEE_TRUSTEE_EMAIL_SENT" }),
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

      await expect(service.resendSettlementTrusteeEmail("note-1", "set-1", actor)).resolves.toMatchObject({
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
      await expect(service.resendSettlementTrusteeEmail("note-1", "set-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_SENT",
      });

      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...submittedSent,
        service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.PENDING_LETTER,
      });
      await expect(service.resendSettlementTrusteeEmail("note-1", "set-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_NOT_RESENDABLE",
      });

      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...submittedSent,
        service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.COMPLETED,
      });
      await expect(service.resendSettlementTrusteeEmail("note-1", "set-1", actor)).rejects.toMatchObject({
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

      await expect(service.resendSettlementTrusteeEmail("note-1", "set-1", actor)).rejects.toThrow(
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

      await expect(service.resendSettlementTrusteeEmail("note-1", "set-1", actor)).rejects.toMatchObject({
        code: "TRUSTEE_EMAIL_RESEND_STATE_CHANGED",
        message: expect.stringMatching(/accepted by the mail service[\s\S]*Refresh this page/i),
      });
      expect(sendTrusteeInstructionPdfEmail).toHaveBeenCalled();
      expect(prisma.noteEvent.create).not.toHaveBeenCalled();
      expect(service.getAdminNoteDetail).not.toHaveBeenCalled();
    });
  });

  describe("markSettlementTrusteeInstructionCompleted", () => {
    it("writes SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED and notifies the issuer once", async () => {
      (prisma.noteSettlement.findFirst as jest.Mock).mockResolvedValue({
        ...settlementRow,
        service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE,
        issuer_residual_amount: 0,
      });
      (prisma.note.findUnique as jest.Mock).mockResolvedValue({
        id: "note-1",
        source_contract_id: null,
        source_invoice_id: null,
        source_application_id: null,
        issuer_organization_id: "org-1",
        title: "Note One",
        note_reference: "NT-1",
      });
      (prisma.note.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await expect(
        service.markSettlementTrusteeInstructionCompleted("note-1", "set-1", actor)
      ).resolves.toMatchObject({ id: "note-1" });

      expect(prisma.noteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED",
            metadata: expect.objectContaining({ settlementId: "set-1" }),
          }),
        })
      );
      expect(prisma.noteEvent.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED",
          }),
        })
      );
      expect(noteLifecycle.notifyNoteIssuerRepaid).toHaveBeenCalledTimes(1);
      expect(noteLifecycle.notifyNoteIssuerRepaid).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: "note-1",
          issuerOrganizationId: "org-1",
        })
      );
    });
  });
});
