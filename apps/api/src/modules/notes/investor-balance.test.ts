import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { debitInvestorBalanceForCommit } from "./investor-balance";

describe("debitInvestorBalanceForCommit", () => {
  it("throws AppError when available balance is insufficient", async () => {
    const tx = {
      investorBalance: {
        upsert: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          available_amount: new Prisma.Decimal("10.000000"),
        }),
      },
      investorBalanceTransaction: {
        create: jest.fn(),
      },
    };

    await expect(
      debitInvestorBalanceForCommit(tx as unknown as Prisma.TransactionClient, {
        investorOrganizationId: "org_1",
        amount: 100,
        noteId: "note_1",
        noteInvestmentId: "inv_1",
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: "INSUFFICIENT_INVESTOR_BALANCE",
        statusCode: 422,
      })
    );

    expect(tx.investorBalanceTransaction.create).not.toHaveBeenCalled();
  });

  it("writes transaction when debit succeeds", async () => {
    const tx = {
      investorBalance: {
        upsert: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      investorBalanceTransaction: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    await debitInvestorBalanceForCommit(tx as unknown as Prisma.TransactionClient, {
      investorOrganizationId: "org_1",
      amount: 50,
      noteId: "note_1",
      noteInvestmentId: "inv_1",
    });

    expect(tx.investorBalanceTransaction.create).toHaveBeenCalledTimes(1);
  });
});
