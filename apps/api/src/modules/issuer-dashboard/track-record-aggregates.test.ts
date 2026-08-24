import { NoteStatus } from "@prisma/client";
import {
  computeOnTimePaymentRatePercent,
  computeProspectusSuccessfulRepaymentPercent,
  countProspectusTotalNotesFunded,
  sumProspectusTotalAmountFunded,
} from "./track-record-aggregates";

describe("issuer track-record aggregates (shared dashboard + prospectus)", () => {
  const notes = [
    { id: "current", status: NoteStatus.ACTIVE, funded_amount: 500_000 },
    { id: "a", status: NoteStatus.ACTIVE, funded_amount: 100_000 },
    { id: "b", status: NoteStatus.REPAID, funded_amount: 200_000 },
    { id: "c", status: NoteStatus.ARREARS, funded_amount: 50_000 },
    { id: "d", status: NoteStatus.DEFAULTED, funded_amount: 25_000 },
    { id: "e", status: NoteStatus.DRAFT, funded_amount: 999_000 },
    { id: "f", status: NoteStatus.FAILED_FUNDING, funded_amount: 0 },
  ];

  it("counts eligible funded-history notes and excludes current Note", () => {
    expect(countProspectusTotalNotesFunded(notes, "current")).toBe(4);
    expect(sumProspectusTotalAmountFunded(notes, "current")).toBe(375_000);
  });

  it("computes successful repayment as REPAID / (REPAID+ARREARS+DEFAULTED)", () => {
    expect(computeProspectusSuccessfulRepaymentPercent(notes, "current")).toBe(33);
    expect(
      computeProspectusSuccessfulRepaymentPercent(
        [{ id: "a", status: NoteStatus.ACTIVE, funded_amount: 1 }],
        null
      )
    ).toBeNull();
  });

  it("computes six-month on-time rate and excludes current Note schedules", () => {
    const now = new Date("2025-07-01T00:00:00.000Z");
    const windowStart = new Date("2025-01-01T00:00:00.000Z");
    const schedules = [
      {
        id: "s1",
        note_id: "b",
        due_date: new Date("2025-06-01T00:00:00.000Z"),
        expected_total: 100,
      },
      {
        id: "s2",
        note_id: "current",
        due_date: new Date("2025-06-15T00:00:00.000Z"),
        expected_total: 100,
      },
    ];
    const payments = [
      {
        schedule_id: "s1",
        receipt_date: new Date("2025-05-30T00:00:00.000Z"),
        receipt_amount: 100,
      },
      {
        schedule_id: "s2",
        receipt_date: new Date("2025-06-01T00:00:00.000Z"),
        receipt_amount: 100,
      },
    ];

    expect(
      computeOnTimePaymentRatePercent({
        schedules,
        payments,
        now,
        windowStart,
        excludeNoteId: "current",
      })
    ).toBe(100);

    expect(
      computeOnTimePaymentRatePercent({
        schedules: [],
        payments: [],
        now,
        windowStart,
        excludeNoteId: "current",
      })
    ).toBeNull();

    expect(
      computeOnTimePaymentRatePercent({
        schedules: [
          {
            id: "pending",
            note_id: "b",
            due_date: null,
            expected_total: 100,
          },
        ],
        payments: [],
        now,
        windowStart,
        excludeNoteId: "current",
      })
    ).toBeNull();
  });
});
