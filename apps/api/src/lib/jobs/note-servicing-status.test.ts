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
  servicingTransitionTimestampUpdate,
  shouldSendArrearsLetter,
  shouldRetryServicingTransitionSideEffects,
  shouldSendServicingLetter,
  shouldProcessServicingNote,
  servicingJobNoteWhere,
  servicingTransitionNotificationKeyPrefixes,
  servicingTransitionNotificationsDelivered,
} from "./note-servicing-status";
import { NoteFundingStatus, NoteServicingStatus } from "@prisma/client";

describe("servicingTransitionTimestampUpdate", () => {
  it("stores the actual UTC occurrence instant when an MYT calendar day has already advanced", () => {
    const now = new Date("2026-01-01T16:30:00.000Z");

    expect(
      servicingTransitionTimestampUpdate(
        {
          overdueStartedAt: null,
          lateStartedAt: null,
          arrearsStartedAt: null,
        },
        NoteServicingStatus.ARREARS,
        now
      )
    ).toEqual({
      overdue_started_at: now,
      late_started_at: now,
      arrears_started_at: now,
    });
  });

  it("does not overwrite lifecycle timestamps recorded by earlier transitions", () => {
    const overdueStartedAt = new Date("2026-01-01T01:00:00.000Z");

    expect(
      servicingTransitionTimestampUpdate(
        {
          overdueStartedAt,
          lateStartedAt: null,
          arrearsStartedAt: null,
        },
        NoteServicingStatus.LATE,
        new Date("2026-01-08T01:00:00.000Z")
      )
    ).toEqual({
      overdue_started_at: undefined,
      late_started_at: new Date("2026-01-08T01:00:00.000Z"),
      arrears_started_at: undefined,
    });
  });
});

describe("shouldProcessServicingNote", () => {
  it("does not start servicing before note activation", () => {
    expect(shouldProcessServicingNote(NoteServicingStatus.NOT_STARTED)).toBe(false);
    expect(shouldProcessServicingNote(NoteServicingStatus.CURRENT)).toBe(true);
    expect(shouldProcessServicingNote(NoteServicingStatus.ARREARS)).toBe(true);
  });

  it("excludes unactivated and old settled notes from the job query", () => {
    const cutoff = new Date("2026-09-09T16:00:00.000Z");
    expect(servicingJobNoteWhere(cutoff)).toEqual({
      funding_status: NoteFundingStatus.FUNDED,
      OR: [
        {
          servicing_status: {
            notIn: [NoteServicingStatus.NOT_STARTED, NoteServicingStatus.SETTLED],
          },
        },
        { repaid_at: { gte: cutoff } },
      ],
    });
  });
});

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
    expect(servicingTransitionNotificationsDelivered([], [`${prefixes[0]}:user:u1`])).toBe(false);
  });

  it("retries when email was selected but SES never marked the row sent", () => {
    const prefixes = servicingTransitionNotificationKeyPrefixes(NoteServicingStatus.OVERDUE, "note-1");
    const issuerKey = `${prefixes[0]}:user:u1`;
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: issuerKey,
            send_to_email: true,
            email_sent_at: null,
          },
        ],
        [issuerKey]
      )
    ).toBe(false);
  });

  it("does not treat a delivered investor LATE row as issuer delivery", () => {
    const prefixes = servicingTransitionNotificationKeyPrefixes(NoteServicingStatus.LATE, "note-1");
    const issuerKey = `${prefixes[0]}:user:u1`;
    const investorKey = `${prefixes[1]}:investor-org:org-1:user:u2`;
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: investorKey,
            send_to_email: true,
            email_sent_at: new Date("2026-09-10T00:00:00.000Z"),
          },
        ],
        [issuerKey, investorKey]
      )
    ).toBe(false);
  });

  it("retries when one issuer recipient is missing from a delivered batch", () => {
    const prefixes = servicingTransitionNotificationKeyPrefixes(NoteServicingStatus.OVERDUE, "note-1");
    const delivered = `${prefixes[0]}:user:u1`;
    const missing = `${prefixes[0]}:user:u2`;
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: delivered,
            send_to_email: true,
            email_sent_at: new Date("2026-09-10T00:00:00.000Z"),
          },
        ],
        [delivered, missing]
      )
    ).toBe(false);
  });

  it("treats platform-only delivery as complete and requires every expected key", () => {
    const prefixes = servicingTransitionNotificationKeyPrefixes(NoteServicingStatus.ARREARS, "note-1");
    const issuerKey = `${prefixes[0]}:user:u1`;
    const investorKey = `${prefixes[1]}:investor-org:org-1:user:u2`;
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: issuerKey,
            send_to_email: false,
            email_sent_at: null,
          },
        ],
        [issuerKey, investorKey]
      )
    ).toBe(false);
    expect(
      servicingTransitionNotificationsDelivered(
        [
          {
            idempotency_key: issuerKey,
            send_to_email: false,
            email_sent_at: null,
          },
          {
            idempotency_key: investorKey,
            send_to_email: true,
            email_sent_at: new Date("2026-09-10T00:00:00.000Z"),
          },
        ],
        [issuerKey, investorKey]
      )
    ).toBe(true);
  });
});
