import { WithdrawalStatus, WithdrawalType } from "@prisma/client";
import { noteService } from "./service";
import { prisma } from "../../lib/prisma";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    withdrawalInstruction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    shorakaTradeOrder: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../lib/s3/client", () => ({
  generatePresignedViewUrl: jest.fn(),
  putS3ObjectBuffer: jest.fn(),
}));

describe("Tawarruq certificate guard (generate-issuer-disbursement trustee letter)", () => {
  const actor = {
    userId: "actor-user",
    role: "ADMIN",
    portal: "ADMIN",
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    correlationId: "corr-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(noteService as any, "mapWithdrawal").mockImplementation((w: unknown) => ({ id: (w as any).id }));
  });

  it("rejects ISSUER_DISBURSEMENT when Tawarruq Certificate is missing", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "withdrawal-1",
      status: WithdrawalStatus.DRAFT,
      withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
      note_id: null,
      amount: 100,
      currency: "MYR",
      beneficiary_snapshot: {},
      gross_funded_amount: null,
      platform_fee_amount: null,
      net_issuer_disbursement: null,
      letter_s3_key: null,
    });
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue({ certificate_s3_key: null });

    await expect(noteService.generateWithdrawalLetter("withdrawal-1", actor)).rejects.toMatchObject({
      code: "TAWARRUQ_CERTIFICATE_REQUIRED_FOR_TRUSTEE_LETTER",
      statusCode: 400,
      message: "Tawarruq Certificate must be fetched before generating the trustee letter.",
    });

    expect(prisma.withdrawalInstruction.update).not.toHaveBeenCalled();
  });

  it("allows ISSUER_DISBURSEMENT when Tawarruq Certificate exists", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "withdrawal-2",
      status: WithdrawalStatus.DRAFT,
      withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
      note_id: null,
      amount: 100,
      currency: "MYR",
      beneficiary_snapshot: {},
      gross_funded_amount: null,
      platform_fee_amount: null,
      net_issuer_disbursement: null,
      letter_s3_key: null,
    });
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue({ certificate_s3_key: "key" });

    (prisma.withdrawalInstruction.update as jest.Mock).mockResolvedValue({
      id: "withdrawal-2",
    });

    await expect(noteService.generateWithdrawalLetter("withdrawal-2", actor)).resolves.toMatchObject({
      id: "withdrawal-2",
    });

    expect(prisma.withdrawalInstruction.update).toHaveBeenCalled();
  });

  it("does not block ISSUER_RESIDUAL_RETURN generation when Tawarruq Certificate is missing", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "withdrawal-3",
      status: WithdrawalStatus.DRAFT,
      withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN,
      note_id: null,
      amount: 0,
      currency: "MYR",
      beneficiary_snapshot: {},
      gross_funded_amount: null,
      platform_fee_amount: null,
      net_issuer_disbursement: null,
      letter_s3_key: null,
    });
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue(null);

    (prisma.withdrawalInstruction.update as jest.Mock).mockResolvedValue({
      id: "withdrawal-3",
    });

    await expect(noteService.generateWithdrawalLetter("withdrawal-3", actor)).resolves.toMatchObject({
      id: "withdrawal-3",
    });

    expect(prisma.withdrawalInstruction.update).toHaveBeenCalled();
  });
});

