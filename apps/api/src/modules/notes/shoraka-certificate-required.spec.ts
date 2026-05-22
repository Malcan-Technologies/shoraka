import { WithdrawalStatus, WithdrawalType } from "@prisma/client";
import { noteService } from "./service";
import { prisma } from "../../lib/prisma";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    withdrawalInstruction: {
      findUnique: jest.fn(),
    },
    shorakaTradeOrder: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe("Shoraka certificate guard (mark-withdrawal-completed)", () => {
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

    jest
      .spyOn(noteService as any, "mapWithdrawal")
      .mockImplementation((w: unknown) => ({ id: (w as any).id }));
  });

  it("rejects ISSUER_DISBURSEMENT without Shoraka order", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "withdrawal-1",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
      note_id: null,
      amount: 100,
    });

    const tx = {
      shorakaTradeOrder: { findUnique: jest.fn().mockResolvedValue(null) },
      withdrawalInstruction: {
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));

    await expect(noteService.markWithdrawalCompleted("withdrawal-1", actor)).rejects.toMatchObject({
      code: "SHORAKA_CERTIFICATE_REQUIRED",
      statusCode: 400,
      message:
        "Shoraka certificate must be fetched before marking issuer disbursement as completed.",
    });

    expect(tx.withdrawalInstruction.updateMany).not.toHaveBeenCalled();
  });

  it("rejects ISSUER_DISBURSEMENT with Shoraka order but no certificate_s3_key", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "withdrawal-2",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
      note_id: null,
      amount: 100,
    });

    const tx = {
      shorakaTradeOrder: { findUnique: jest.fn().mockResolvedValue({ certificate_s3_key: null }) },
      withdrawalInstruction: {
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));

    await expect(noteService.markWithdrawalCompleted("withdrawal-2", actor)).rejects.toMatchObject({
      code: "SHORAKA_CERTIFICATE_REQUIRED",
      statusCode: 400,
    });

    expect(tx.withdrawalInstruction.updateMany).not.toHaveBeenCalled();
  });

  it("allows ISSUER_DISBURSEMENT when certificate_s3_key exists", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "withdrawal-3",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
      note_id: null,
      amount: 100,
    });

    const tx = {
      shorakaTradeOrder: { findUnique: jest.fn().mockResolvedValue({ certificate_s3_key: "key" }) },
      withdrawalInstruction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "withdrawal-3" }),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));

    await expect(noteService.markWithdrawalCompleted("withdrawal-3", actor)).resolves.toMatchObject({
      id: "withdrawal-3",
    });

    expect(tx.withdrawalInstruction.updateMany).toHaveBeenCalledTimes(1);
  });

  it("does not block non-ISSUER_DISBURSEMENT withdrawals", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "withdrawal-4",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN,
      note_id: null,
      amount: 0,
    });

    const tx = {
      shorakaTradeOrder: { findUnique: jest.fn().mockResolvedValue(null) },
      withdrawalInstruction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "withdrawal-4" }),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));

    await expect(noteService.markWithdrawalCompleted("withdrawal-4", actor)).resolves.toMatchObject({
      id: "withdrawal-4",
    });

    expect(tx.withdrawalInstruction.updateMany).toHaveBeenCalledTimes(1);
  });
});

