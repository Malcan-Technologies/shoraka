import { NotificationTypeIds, getNotificationContent } from "./registry";
import {
  excessLateChargesDueIdempotencyKey,
  excessLateChargesPaidIdempotencyKey,
  shouldNotifyExcessLateChargesDue,
} from "./excess-late-charge-notifications";

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
