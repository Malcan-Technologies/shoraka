import { aggregateBookMetricNotes, aggregateDueSoonBookMetric } from "./book-metrics-calculation";

function note(overrides: Record<string, unknown> = {}) {
  return {
    funded_amount: 100_000,
    profit_rate_percent: 10,
    tenure_days: 365,
    disbursement_value_date: new Date("2026-01-01T00:00:00.000Z"),
    activated_at: new Date("2026-01-01T00:00:00.000Z"),
    maturity_date: new Date("2027-01-01T00:00:00.000Z"),
    payment_schedules: [] as Array<{ due_date: Date | null; sequence: number | null }>,
    settlements: [] as Array<{ investor_principal: number; investor_profit_gross: number }>,
    ...overrides,
  };
}

describe("admin book metric calculations", () => {
  it("uses remaining principal and profit after posted recoveries", () => {
    expect(
      aggregateBookMetricNotes([
        note({
          settlements: [{ investor_principal: 40_000, investor_profit_gross: 4_000 }],
        }),
      ])
    ).toEqual({ amount: 66_000, count: 1 });
  });

  it("uses the servicing schedule due date for the due-soon bucket", () => {
    const start = new Date("2026-09-01T00:00:00.000Z");
    const end = new Date("2026-09-08T00:00:00.000Z");
    const scheduled = note({
      maturity_date: new Date("2026-10-01T00:00:00.000Z"),
      payment_schedules: [
        { due_date: new Date("2026-09-05T00:00:00.000Z"), sequence: 1 },
      ],
    });
    const maturityOnly = note({
      maturity_date: new Date("2026-09-06T00:00:00.000Z"),
    });

    expect(aggregateDueSoonBookMetric([scheduled, maturityOnly], start, end)).toEqual({
      amount: 220_000,
      count: 2,
    });
  });
});
