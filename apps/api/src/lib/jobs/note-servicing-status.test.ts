jest.mock("../prisma", () => ({
  prisma: {},
}));

jest.mock("../../modules/notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../modules/notes/servicing-letters/service", () => ({
  generateAndSendServicingLetter: jest.fn(),
  resendServicingLetter: jest.fn(),
}));

jest.mock("../../modules/admin/book-metrics-snapshot", () => ({
  writeTodayBookMetricsSnapshot: jest.fn(),
}));

import {
  shouldSendArrearsLetter,
  shouldRetryServicingTransitionSideEffects,
  shouldSendServicingLetter,
  servicingTransitionDeliveryLogKeys,
  servicingTransitionNotificationsDelivered,
} from "./note-servicing-status";
import { NoteServicingStatus } from "@prisma/client";
import { systemNotificationLogKey } from "../../modules/notification/delivery-log";
import { NotificationTypeIds } from "../../modules/notification/registry";

describe("shouldSendArrearsLetter", () => {
  it("generates when no letter exists", () => {
    expect(shouldSendArrearsLetter(null)).toBe("generate");
  });

  it("retries when a letter was stored without a successful send", () => {
    expect(shouldSendArrearsLetter({ sent_at: null })).toBe("retry");
  });

  it("skips when a letter has already been emailed", () => {
    expect(shouldSendArrearsLetter({ sent_at: new Date("2026-09-09T00:00:00.000Z") })).toBe("skip");
  });
});

describe("shouldSendServicingLetter", () => {
  it("retries unsent default notices the same way as arrears notices", () => {
    expect(shouldSendServicingLetter({ sent_at: null })).toBe("retry");
  });
});

describe("shouldRetryServicingTransitionSideEffects", () => {
  it("retries overdue, late, and arrears events after the status already advanced", () => {
    expect(
      shouldRetryServicingTransitionSideEffects({
        hasPostedSettlement: false,
        canTransition: false,
        currentStatus: NoteServicingStatus.LATE,
        classifiedStatus: NoteServicingStatus.LATE,
      })
    ).toBe(true);
  });

  it("does not retry when the job is still advancing status on this run", () => {
    expect(
      shouldRetryServicingTransitionSideEffects({
        hasPostedSettlement: false,
        canTransition: true,
        currentStatus: NoteServicingStatus.OVERDUE,
        classifiedStatus: NoteServicingStatus.LATE,
      })
    ).toBe(false);
  });
});

describe("servicingTransitionNotificationsDelivered", () => {
  it("retries when the transition event exists but no delivery was recorded", () => {
    const keys = servicingTransitionDeliveryLogKeys(NoteServicingStatus.LATE, "note-1");
    expect(keys).toEqual([
      systemNotificationLogKey(NotificationTypeIds.NOTE_LATE, "note:servicing:note-1:late"),
      systemNotificationLogKey(
        NotificationTypeIds.NOTE_LATE_INVESTOR,
        "note:servicing:note-1:late:investor"
      ),
    ]);
    expect(servicingTransitionNotificationsDelivered([], keys)).toBe(false);
  });

  it("does not treat a zero-delivery log as success", () => {
    const keys = servicingTransitionDeliveryLogKeys(NoteServicingStatus.OVERDUE, "note-1");
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: keys[0] ?? null,
            delivered_platform_count: 0,
            delivered_email_count: 0,
          },
        ],
        keys
      )
    ).toBe(false);
  });

  it("requires every expected batch to have been delivered", () => {
    const keys = servicingTransitionDeliveryLogKeys(NoteServicingStatus.ARREARS, "note-1");
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: keys[0] ?? null,
            delivered_platform_count: 1,
            delivered_email_count: 0,
          },
        ],
        keys
      )
    ).toBe(false);
    expect(
      servicingTransitionNotificationsDelivered(
        keys.map((key) => ({
          idempotency_key: key,
          delivered_platform_count: 1,
          delivered_email_count: 0,
        })),
        keys
      )
    ).toBe(true);
  });
});
