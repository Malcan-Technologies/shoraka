const sendTyped = jest.fn().mockResolvedValue({ id: "n1" });
const logTypedSystemBatch = jest.fn().mockResolvedValue(undefined);

jest.mock("./service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped,
    logTypedSystemBatch,
  })),
}));

jest.mock("./org-member-recipients", () => ({
  listInvestorOrgMemberUserIds: jest.fn(),
}));

import { GatewayPaymentPurpose } from "@prisma/client";
import { listInvestorOrgMemberUserIds } from "./org-member-recipients";
import { NotificationTypeIds } from "./registry";
import {
  notifyDepositNameCheckRejected,
  notifyDepositRefundInitiated,
  notifyDepositRefunded,
  notifyDepositSuccessful,
} from "./gateway-payment-notifications";

function depositPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "gp-1",
    purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
    investor_organization_id: "inv-org-1",
    amount: { toNumber: () => 1500 },
    ...overrides,
  } as never;
}

describe("gateway deposit notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listInvestorOrgMemberUserIds as jest.Mock).mockResolvedValue(["inv-owner", "inv-member"]);
  });

  it("sends name-check rejected to the deposit's investor org members only", async () => {
    await notifyDepositNameCheckRejected(depositPayment());

    expect(listInvestorOrgMemberUserIds).toHaveBeenCalledWith("inv-org-1");
    expect(sendTyped).toHaveBeenCalledTimes(2);
    expect(sendTyped).toHaveBeenCalledWith(
      "inv-owner",
      NotificationTypeIds.DEPOSIT_NAME_CHECK_REJECTED,
      { amount: 1500 },
      "gateway-payment:gp-1:notif:deposit_name_check_rejected:user:inv-owner:name_check_rejected"
    );
    expect(sendTyped.mock.calls.every((c) => c[0] === "inv-owner" || c[0] === "inv-member")).toBe(
      true
    );
  });

  it("does not notify for non-deposit gateway purposes", async () => {
    await notifyDepositNameCheckRejected(
      depositPayment({ purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE, issuer_organization_id: "iss-1" })
    );
    await notifyDepositRefundInitiated(
      depositPayment({ purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE })
    );
    await notifyDepositRefunded(depositPayment({ purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE }));

    expect(sendTyped).not.toHaveBeenCalled();
    expect(listInvestorOrgMemberUserIds).not.toHaveBeenCalled();
  });

  it("uses stable per-payment idempotency keys so webhook retries do not duplicate", async () => {
    await notifyDepositRefundInitiated(depositPayment());
    await notifyDepositRefundInitiated(depositPayment());

    const keys = sendTyped.mock.calls.map((c) => c[3]);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every((k: string) => k.includes("refund_initiated"))).toBe(true);
  });

  it("sends refunded with the deposit amount on platform only", async () => {
    await notifyDepositRefunded(depositPayment());

    expect(sendTyped).toHaveBeenCalledWith(
      "inv-owner",
      NotificationTypeIds.DEPOSIT_REFUNDED,
      { amount: 1500 },
      expect.stringContaining("refunded")
    );
  });

  it("sends successful deposit once to investor org members with the credited amount", async () => {
    await notifyDepositSuccessful(depositPayment());

    expect(listInvestorOrgMemberUserIds).toHaveBeenCalledWith("inv-org-1");
    expect(sendTyped).toHaveBeenCalledTimes(2);
    expect(sendTyped).toHaveBeenCalledWith(
      "inv-owner",
      NotificationTypeIds.DEPOSIT_SUCCESSFUL,
      { amount: 1500 },
      "gateway-payment:gp-1:notif:deposit_successful:user:inv-owner:successful"
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
    expect(logTypedSystemBatch).toHaveBeenCalledWith(
      NotificationTypeIds.DEPOSIT_SUCCESSFUL,
      { amount: 1500 },
      expect.any(Array),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining("deposit_successful"),
      })
    );
    expect(sendTyped.mock.calls.every((c) => c.length === 4)).toBe(true);
  });

  it("does not duplicate successful-deposit sends on webhook replay of the same payment", async () => {
    await notifyDepositSuccessful(depositPayment());
    await notifyDepositSuccessful(depositPayment());

    const keys = sendTyped.mock.calls.map((c) => c[3]);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every((k: string) => k.includes("deposit_successful"))).toBe(true);
  });

  it("does not notify successful deposit for non-deposit gateway purposes", async () => {
    await notifyDepositSuccessful(
      depositPayment({ purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE })
    );
    expect(sendTyped).not.toHaveBeenCalled();
  });

  it("does not send reject or refund types from the successful-credit helper", async () => {
    await notifyDepositSuccessful(depositPayment());
    const typeIds = sendTyped.mock.calls.map((c) => c[1]);
    expect(typeIds.every((id) => id === NotificationTypeIds.DEPOSIT_SUCCESSFUL)).toBe(true);
  });
});
