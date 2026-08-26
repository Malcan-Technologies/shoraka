import { NotificationTypeIds, getNotificationContent } from "./registry";
import {
  excessLateChargesDueIdempotencyKey,
  excessLateChargesPaidIdempotencyKey,
  notifyExcessLateChargesDue,
  shouldNotifyExcessLateChargesDue,
} from "./excess-late-charge-notifications";

const sendTyped = jest.fn().mockResolvedValue({ id: "n1" });
const logTypedSystemBatch = jest.fn().mockResolvedValue(undefined);

jest.mock("./service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped,
    logTypedSystemBatch,
  })),
}));

const mockListIssuer = jest.fn();
jest.mock("./org-member-recipients", () => ({
  listIssuerOrgMemberUserIds: (...args: unknown[]) => mockListIssuer(...args),
}));

describe("excess late charge notifications", () => {
  it("builds stable idempotency keys", () => {
    expect(excessLateChargesDueIdempotencyKey("set-1", "user-1")).toBe(
      `settlement:set-1:notif:${NotificationTypeIds.EXCESS_LATE_CHARGES_DUE}:user:user-1`
    );
    expect(excessLateChargesPaidIdempotencyKey("note-1", "user-1")).toBe(
      `note:note-1:notif:${NotificationTypeIds.EXCESS_LATE_CHARGES_PAID}:user:user-1`
    );
  });

  it("only notifies due when outstanding is positive", () => {
    expect(shouldNotifyExcessLateChargesDue(80)).toBe(true);
    expect(shouldNotifyExcessLateChargesDue(0)).toBe(false);
  });

  it("renders issuer copy that names the note and amount", () => {
    const due = getNotificationContent(NotificationTypeIds.EXCESS_LATE_CHARGES_DUE, {
      noteId: "note-1",
      noteReference: "NOTE-1",
      outstandingAmount: 250,
    });
    expect(due.title).toBe("Outstanding late charges to pay");
    expect(due.message).toContain("NOTE-1");
    expect(due.linkPath).toBe("/financing/notes/note-1#late-charges");

    const paid = getNotificationContent(NotificationTypeIds.EXCESS_LATE_CHARGES_PAID, {
      noteId: "note-1",
      noteReference: "NOTE-1",
      paidAmount: 250,
    });
    expect(paid.title).toBe("Late payment charges received");
    expect(paid.linkPath).toBe("/financing/notes/note-1");
  });
});

describe("notifyExcessLateChargesDue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListIssuer.mockResolvedValue(["user-1", "user-2"]);
  });

  it("writes one SYSTEM batch log for the issuer org", async () => {
    await notifyExcessLateChargesDue({
      noteId: "note-1",
      settlementId: "set-1",
      issuerOrganizationId: "org-1",
      noteReference: "NOTE-1",
      outstandingAmount: 80,
    });

    expect(sendTyped).toHaveBeenCalledTimes(2);
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
    expect(logTypedSystemBatch).toHaveBeenCalledWith(
      NotificationTypeIds.EXCESS_LATE_CHARGES_DUE,
      {
        noteId: "note-1",
        noteReference: "NOTE-1",
        outstandingAmount: 80,
      },
      [{ id: "n1" }, { id: "n1" }],
      { idempotencyKey: "system-log:excess_late_charges_due:settlement:set-1" }
    );
  });

  it("does not send or log when outstanding is zero", async () => {
    await notifyExcessLateChargesDue({
      noteId: "note-1",
      settlementId: "set-1",
      issuerOrganizationId: "org-1",
      noteReference: "NOTE-1",
      outstandingAmount: 0,
    });
    expect(sendTyped).not.toHaveBeenCalled();
    expect(logTypedSystemBatch).not.toHaveBeenCalled();
  });
});
