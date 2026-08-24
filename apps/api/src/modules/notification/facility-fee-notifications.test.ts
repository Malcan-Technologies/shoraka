import { getNotificationContent, NotificationTypeIds } from "./registry";
import { initialNotificationTypes } from "./seed-data";
import {
  facilityFeePaymentRequestedIdempotencyKey,
  facilityFeeUpfrontPaidIdempotencyKey,
  notifyFacilityFeeUpfrontPaidIfSettled,
  shouldNotifyFacilityFeePaymentRequested,
  shouldNotifyFacilityFeeUpfrontPaid,
} from "./facility-fee-notifications";

const sendTyped = jest.fn().mockResolvedValue({ id: "n1" });

jest.mock("./service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped,
  })),
}));

const mockFindUnique = jest.fn();
jest.mock("../../lib/prisma", () => ({
  prisma: {
    contract: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

const mockListIssuer = jest.fn();
jest.mock("./org-member-recipients", () => ({
  listIssuerOrgMemberUserIds: (...args: unknown[]) => mockListIssuer(...args),
}));

describe("facility fee notification conditions", () => {
  it("requests payment only when upfront is greater than zero", () => {
    expect(shouldNotifyFacilityFeePaymentRequested(400)).toBe(true);
    expect(shouldNotifyFacilityFeePaymentRequested(0)).toBe(false);
  });

  it("marks paid only when outstanding is zero, including waived", () => {
    expect(
      shouldNotifyFacilityFeeUpfrontPaid({
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 400,
        facility_fee_total_amount: 1_500,
      })
    ).toBe(true);
    expect(
      shouldNotifyFacilityFeeUpfrontPaid({
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 0,
        facility_fee_total_amount: 1_500,
        facility_fee_waived: true,
      })
    ).toBe(true);
    expect(
      shouldNotifyFacilityFeeUpfrontPaid({
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 100,
        facility_fee_total_amount: 1_500,
      })
    ).toBe(false);
  });

  it("uses stable per-contract idempotency keys", () => {
    expect(facilityFeePaymentRequestedIdempotencyKey("con-1", "user-1")).toBe(
      `contract:con-1:notif:${NotificationTypeIds.FACILITY_FEE_PAYMENT_REQUESTED}:user:user-1`
    );
    expect(facilityFeeUpfrontPaidIdempotencyKey("con-1", "user-1")).toBe(
      `contract:con-1:notif:${NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID}:user:user-1`
    );
    expect(facilityFeeUpfrontPaidIdempotencyKey("con-1", "user-1")).toBe(
      facilityFeeUpfrontPaidIdempotencyKey("con-1", "user-1")
    );
  });

  it("registers seed and portal links for issuer financing contract pages", () => {
    expect(initialNotificationTypes.map((type) => type.id)).toEqual(
      expect.arrayContaining([
        NotificationTypeIds.FACILITY_FEE_PAYMENT_REQUESTED,
        NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID,
      ])
    );
    const requested = getNotificationContent(NotificationTypeIds.FACILITY_FEE_PAYMENT_REQUESTED, {
      applicationId: "app-1",
      contractId: "con-1",
      upfrontAmount: 400,
    });
    expect(requested.linkPath).toBe("/financing/contracts/con-1");
    expect(requested.portal).toBe("issuer");
    expect(requested.message).toContain("400");
    const paid = getNotificationContent(NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID, {
      contractId: "con-1",
      upfrontAmount: 400,
    });
    expect(paid.linkPath).toBe("/financing/contracts/con-1");
    expect(paid.portal).toBe("issuer");
  });
});

describe("notifyFacilityFeeUpfrontPaidIfSettled", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListIssuer.mockResolvedValue(["user-1", "user-2"]);
  });

  it("sends once per recipient after outstanding reaches zero", async () => {
    mockFindUnique.mockResolvedValue({
      issuer_organization_id: "org-1",
      contract_details: {
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 400,
        facility_fee_total_amount: 1_500,
      },
    });

    await notifyFacilityFeeUpfrontPaidIfSettled({ contractId: "con-1" });

    expect(sendTyped).toHaveBeenCalledTimes(2);
    expect(sendTyped).toHaveBeenCalledWith(
      "user-1",
      NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID,
      { contractId: "con-1", upfrontAmount: 400 },
      facilityFeeUpfrontPaidIdempotencyKey("con-1", "user-1")
    );
    expect(sendTyped).toHaveBeenCalledWith(
      "user-2",
      NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID,
      { contractId: "con-1", upfrontAmount: 400 },
      facilityFeeUpfrontPaidIdempotencyKey("con-1", "user-2")
    );
  });

  it("does not send while outstanding remains", async () => {
    mockFindUnique.mockResolvedValue({
      issuer_organization_id: "org-1",
      contract_details: {
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 100,
        facility_fee_total_amount: 1_500,
      },
    });

    await notifyFacilityFeeUpfrontPaidIfSettled({ contractId: "con-1" });
    expect(sendTyped).not.toHaveBeenCalled();
  });

  it("does not fail when delivery throws", async () => {
    mockFindUnique.mockResolvedValue({
      issuer_organization_id: "org-1",
      contract_details: {
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 400,
        facility_fee_total_amount: 1_500,
      },
    });
    sendTyped.mockRejectedValueOnce(new Error("delivery failed"));

    await expect(notifyFacilityFeeUpfrontPaidIfSettled({ contractId: "con-1" })).resolves.toBeUndefined();
  });
});
