import { OpsAlertSeverity, OpsAlertStatus, OpsAlertType } from "@prisma/client";

const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockTransaction = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    opsAlert: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock("../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { acknowledgeOpsAlert, raiseOpsAlert, resolveOpsAlert } from "./service";

describe("ops alerts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an OPEN alert on first raise and increments on replay", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValue({ id: "alert-1" });
    await raiseOpsAlert({
      type: OpsAlertType.STUCK_PAYMENT,
      severity: OpsAlertSeverity.HIGH,
      dedupeKey: "stuck-payment:pay-1",
      title: "Stuck payment",
      entityType: "gateway_payment",
      entityId: "pay-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupe_key: "stuck-payment:pay-1",
          type: OpsAlertType.STUCK_PAYMENT,
          entity_id: "pay-1",
        }),
      })
    );

    mockFindUnique.mockResolvedValueOnce({
      id: "alert-1",
      status: OpsAlertStatus.OPEN,
      summary: null,
      entity_type: "gateway_payment",
      entity_id: "pay-1",
      details: null,
    });
    mockUpdate.mockResolvedValue({});
    await raiseOpsAlert({
      type: OpsAlertType.STUCK_PAYMENT,
      severity: OpsAlertSeverity.HIGH,
      dedupeKey: "stuck-payment:pay-1",
      title: "Stuck payment",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ occurrence_count: { increment: 1 } }),
      })
    );
  });

  it("retries persist once and does not throw or recurse when persist keeps failing", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));
    await expect(
      raiseOpsAlert({
        type: OpsAlertType.STUCK_PAYMENT,
        severity: OpsAlertSeverity.HIGH,
        dedupeKey: "stuck-payment:pay-fail",
        title: "Stuck payment",
      })
    ).resolves.toBeUndefined();
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it("acknowledges OPEN then resolves without reusing notification types", async () => {
    mockFindUnique.mockResolvedValue({
      id: "alert-1",
      status: OpsAlertStatus.OPEN,
      owner_user_id: null,
      resolved_at: null,
      resolved_by_user_id: null,
    });
    mockUpdate.mockResolvedValue({
      id: "alert-1",
      type: OpsAlertType.STUCK_PAYMENT,
      severity: OpsAlertSeverity.HIGH,
      status: OpsAlertStatus.ACKNOWLEDGED,
      dedupe_key: "stuck-payment:pay-1",
      title: "Stuck payment",
      summary: null,
      entity_type: "gateway_payment",
      entity_id: "pay-1",
      details: null,
      owner_user_id: "A0001",
      occurrence_count: 1,
      first_seen_at: new Date(),
      last_seen_at: new Date(),
      created_at: new Date(),
      acknowledged_at: new Date(),
      acknowledged_by_user_id: "A0001",
      resolved_at: null,
      resolved_by_user_id: null,
      closed_at: null,
      closed_by_user_id: null,
    });
    const ack = await acknowledgeOpsAlert("alert-1", "A0001");
    expect(ack.status).toBe(OpsAlertStatus.ACKNOWLEDGED);

    mockFindUnique.mockResolvedValue({
      id: "alert-1",
      status: OpsAlertStatus.ACKNOWLEDGED,
      owner_user_id: "A0001",
      resolved_at: null,
      resolved_by_user_id: null,
    });
    mockUpdate.mockResolvedValue({
      ...ack,
      status: OpsAlertStatus.RESOLVED,
      resolved_at: new Date(),
      resolved_by_user_id: "A0001",
      first_seen_at: new Date(ack.firstSeenAt),
      last_seen_at: new Date(ack.lastSeenAt),
      created_at: new Date(ack.createdAt),
      acknowledged_at: ack.acknowledgedAt ? new Date(ack.acknowledgedAt) : null,
    });
    const resolved = await resolveOpsAlert("alert-1", "A0001");
    expect(resolved.status).toBe(OpsAlertStatus.RESOLVED);
  });
});
