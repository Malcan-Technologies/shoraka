const sendTypedPlatformOnly = jest.fn().mockResolvedValue({ id: "n1" });
const listIssuerOrgMemberUserIds = jest.fn();

jest.mock("./service", () => ({
  NotificationService: jest.fn(),
}));

jest.mock("./org-member-recipients", () => ({
  listIssuerOrgMemberUserIds: (...args: unknown[]) => listIssuerOrgMemberUserIds(...args),
}));

import { WithdrawalType } from "@prisma/client";
import {
  notifyInvestorCashWithdrawalCompleted,
  notifyInvestorCashWithdrawalSubmitted,
} from "./investor-withdrawal-notifications";
import { NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";

describe("investor cash withdrawal notifications", () => {
  const svc = { sendTypedPlatformOnly } as unknown as NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends submitted once to the requesting investor, platform-only", async () => {
    await notifyInvestorCashWithdrawalSubmitted({
      notificationService: svc,
      withdrawalId: "w-1",
      requestedByUserId: "inv-user-1",
      amount: 1500,
      withdrawalType: WithdrawalType.INVESTOR_WITHDRAWAL,
    });

    expect(sendTypedPlatformOnly).toHaveBeenCalledTimes(1);
    expect(sendTypedPlatformOnly).toHaveBeenCalledWith(
      "inv-user-1",
      NotificationTypeIds.INVESTOR_WITHDRAWAL_SUBMITTED,
      { amount: 1500 },
      "withdrawal:w-1:notif:investor_withdrawal_submitted:user:inv-user-1"
    );
    expect(listIssuerOrgMemberUserIds).not.toHaveBeenCalled();
  });

  it("sends completed once to the requesting investor", async () => {
    await notifyInvestorCashWithdrawalCompleted({
      notificationService: svc,
      withdrawalId: "w-1",
      requestedByUserId: "inv-user-1",
      amount: 1500,
      withdrawalType: WithdrawalType.INVESTOR_WITHDRAWAL,
    });

    expect(sendTypedPlatformOnly).toHaveBeenCalledTimes(1);
    expect(sendTypedPlatformOnly).toHaveBeenCalledWith(
      "inv-user-1",
      NotificationTypeIds.INVESTOR_WITHDRAWAL_COMPLETED,
      { amount: 1500 },
      "withdrawal:w-1:notif:investor_withdrawal_completed:user:inv-user-1"
    );
  });

  it.each([
    WithdrawalType.ISSUER_DISBURSEMENT,
    WithdrawalType.ISSUER_RESIDUAL_RETURN,
    WithdrawalType.ADMIN_ADJUSTMENT,
    "SETTLEMENT",
  ])("does not notify investors for %s", async (withdrawalType) => {
    await notifyInvestorCashWithdrawalSubmitted({
      notificationService: svc,
      withdrawalId: "w-x",
      requestedByUserId: "inv-user-1",
      amount: 100,
      withdrawalType,
    });
    await notifyInvestorCashWithdrawalCompleted({
      notificationService: svc,
      withdrawalId: "w-x",
      requestedByUserId: "inv-user-1",
      amount: 100,
      withdrawalType,
    });
    expect(sendTypedPlatformOnly).not.toHaveBeenCalled();
  });
});
