const mockDebit = jest.fn();
const mockNotifySubmitted = jest.fn();
const mockNotifyCompleted = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("./investor-balance", () => {
  const actual = jest.requireActual("./investor-balance") as Record<string, unknown>;
  return {
    ...actual,
    debitInvestorBalanceForWithdrawal: (...args: unknown[]) => mockDebit(...args),
  };
});

jest.mock("../notification/investor-withdrawal-notifications", () => ({
  notifyInvestorCashWithdrawalSubmitted: (...args: unknown[]) => mockNotifySubmitted(...args),
  notifyInvestorCashWithdrawalCompleted: (...args: unknown[]) => mockNotifyCompleted(...args),
}));

import { WithdrawalType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NoteService } from "./service";

describe("NoteService createInvestorWithdrawal notification", () => {
  const actor = { userId: "inv-user-1", role: "INVESTOR", portal: "INVESTOR" };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      id: "org-inv-1",
      name: "Investor Org",
      bank_account_details: { bank_name: "Maybank", account_number: "123" },
    });
  });

  it("sends exactly one submitted notification to the requesting investor after debit", async () => {
    const created = {
      id: "w-1",
      withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
      amount: 1500,
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({})
    );
    mockDebit.mockResolvedValue(undefined);
    mockNotifySubmitted.mockResolvedValue(undefined);

    const service = new NoteService();
    jest.spyOn(service as never, "listInvestorOrganizationIds").mockResolvedValue(["org-inv-1"]);
    jest
      .spyOn(service as never, "createWithdrawalInstructionWithDisplayReference")
      .mockResolvedValue(created);
    jest.spyOn(service as never, "mapWithdrawal").mockReturnValue({ id: "w-1" });

    await service.createInvestorWithdrawal(
      { amount: 1500, investorOrganizationId: "org-inv-1" },
      actor
    );

    expect(mockDebit).toHaveBeenCalledTimes(1);
    expect(mockNotifySubmitted).toHaveBeenCalledTimes(1);
    expect(mockNotifySubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        withdrawalId: "w-1",
        requestedByUserId: "inv-user-1",
        amount: 1500,
        withdrawalType: WithdrawalType.INVESTOR_WITHDRAWAL,
      })
    );
    expect(mockNotifyCompleted).not.toHaveBeenCalled();
  });
});
