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
  servicingTransitionNotificationKeyPrefixes,
  servicingTransitionNotificationsDelivered,
} from "./note-servicing-status";
import { NoteServicingStatus } from "@prisma/client";

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
  it("retries when no notification rows exist for the transition", () => {
    const prefixes = servicingTransitionNotificationKeyPrefixes(NoteServicingStatus.LATE, "note-1");
    expect(prefixes).toEqual([
      "note:servicing:note-1:late",
      "note:servicing:note-1:late:investor",
    ]);
    expect(servicingTransitionNotificationsDelivered([], prefixes)).toBe(false);
  });

  it("retries when email was selected but SES never marked the row sent", () => {
    const prefixes = servicingTransitionNotificationKeyPrefixes(NoteServicingStatus.OVERDUE, "note-1");
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: `${prefixes[0]}:user:u1`,
            send_to_email: true,
            email_sent_at: null,
          },
        ],
        prefixes
      )
    ).toBe(false);
  });

  it("treats platform-only delivery as complete and requires every expected batch", () => {
    const prefixes = servicingTransitionNotificationKeyPrefixes(NoteServicingStatus.ARREARS, "note-1");
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: `${prefixes[0]}:user:u1`,
            send_to_email: false,
            email_sent_at: null,
          },
        ],
        prefixes
      )
    ).toBe(false);
    expect(
      servicingTransitionNotificationsDelivered(
        prefixes.map((prefix) => ({
          idempotency_key: `${prefix}:user:u1`,
          send_to_email: true,
          email_sent_at: new Date("2026-09-10T00:00:00.000Z"),
        })),
        prefixes
      )
    ).toBe(true);
  });
});
