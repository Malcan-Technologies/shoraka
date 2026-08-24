import {
  compareNoteTimingSort,
  EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP,
  formatIssuerFinancingTenure,
  formatIssuerMaturityCountdown,
  formatIssuerNoteMaturity,
  formatNoteDateEnMy,
  isCompactNoteTimingValueShort,
  joinNoteTimingExtra,
  resolveIssuerInvoiceNoteTiming,
  MARKETPLACE_RETURN_RATE_TOOLTIP,
  NOTE_TIMING_ACTIVATED_TOOLTIP,
  NOTE_TIMING_FROM_DISBURSEMENT_TOOLTIP,
  NOTE_TIMING_GRACE_TOOLTIP,
  NOTE_TIMING_PAST_MATURITY_TOOLTIP,
  parseNoteDisplayDate,
  resolveMarketplaceFilterDays,
  resolveNoteTimingDisplay,
  shouldLabelExpectedReturnAsUpTo,
} from "./note-timing-display";

describe("formatNoteDateEnMy", () => {
  it("keeps a UTC-midnight Malaysia calendar day stable regardless of host timezone", () => {
    expect(formatNoteDateEnMy("2026-11-18T00:00:00.000Z")).toBe("18 Nov 2026");
    expect(formatNoteDateEnMy("2026-09-12")).toBe("12 Sept 2026");
  });
});

describe("parseNoteDisplayDate", () => {
  it("accepts Date and ISO strings and rejects invalid values", () => {
    expect(parseNoteDisplayDate(new Date("2026-11-18T00:00:00.000Z"))?.toISOString()).toBe(
      "2026-11-18T00:00:00.000Z"
    );
    expect(parseNoteDisplayDate("2026-11-18T00:00:00.000Z")?.toISOString()).toBe(
      "2026-11-18T00:00:00.000Z"
    );
    expect(parseNoteDisplayDate(null)).toBeNull();
    expect(parseNoteDisplayDate("")).toBeNull();
    expect(parseNoteDisplayDate("not-a-date")).toBeNull();
    expect(parseNoteDisplayDate(new Date("invalid"))).toBeNull();
  });
});

describe("resolveNoteTimingDisplay", () => {
  it("shows financing tenure before disbursement on new notes", () => {
    expect(resolveNoteTimingDisplay({ tenureDays: 90, maturityDate: null })).toMatchObject({
      kind: "tenure_pending",
      isTenureNote: true,
      label: "Financing tenure",
      value: "90 days from disbursement",
      compactValue: "90",
      compactLabel: "days",
      compactExtra: null,
      secondary: null,
      filterDays: 90,
      sortTime: null,
      tenureDays: 90,
      tooltip: NOTE_TIMING_FROM_DISBURSEMENT_TOOLTIP,
    });
  });

  it("keeps marketplace compact KPI on tenure after disbursement", () => {
    const display = resolveNoteTimingDisplay({
      tenureDays: 90,
      maturityDate: "2026-11-18T00:00:00.000Z",
    });
    expect(display.kind).toBe("tenure_activated");
    expect(display.label).toBe("Maturity date");
    expect(display.value).toBe(formatNoteDateEnMy("2026-11-18T00:00:00.000Z"));
    expect(display.compactValue).toBe("90");
    expect(display.compactLabel).toBe("days");
    expect(display.compactExtra).toBe(
      `Matures ${formatNoteDateEnMy("2026-11-18T00:00:00.000Z")}`
    );
    expect(display.secondary).toBe("90-day tenure");
    expect(display.tooltip).toBe(NOTE_TIMING_ACTIVATED_TOOLTIP);
    expect(display.filterDays).toBe(90);
    expect(display.sortTime).toBe(new Date("2026-11-18T00:00:00.000Z").getTime());
  });

  it("keeps legacy marketplace compact as Malaysia calendar days left, not tenure", () => {
    const now = new Date("2026-08-24T04:00:00.000Z");
    const display = resolveNoteTimingDisplay(
      {
        tenureDays: null,
        maturityDate: "2026-09-12T00:00:00.000Z",
      },
      now
    );
    expect(display.kind).toBe("legacy");
    expect(display.isTenureNote).toBe(false);
    expect(display.label).toBe("Maturity date");
    expect(display.value).toBe(formatNoteDateEnMy("2026-09-12T00:00:00.000Z"));
    expect(display.compactValue).toBe("19");
    expect(display.compactLabel).toBe("days left");
    expect(display.compactExtra).toBe(
      `Matures ${formatNoteDateEnMy("2026-09-12T00:00:00.000Z")}`
    );
    expect(display.filterDays).toBe(
      resolveMarketplaceFilterDays({ maturityDate: "2026-09-12T00:00:00.000Z" }, now)
    );
  });

  it("uses singular day, today, and past-due labels for legacy compact KPIs", () => {
    const now = new Date("2026-08-24T04:00:00.000Z");
    expect(
      resolveNoteTimingDisplay({ tenureDays: null, maturityDate: "2026-08-25T00:00:00.000Z" }, now)
    ).toMatchObject({
      compactValue: "1",
      compactLabel: "day left",
    });
    expect(
      resolveNoteTimingDisplay({ tenureDays: null, maturityDate: "2026-08-24T00:00:00.000Z" }, now)
    ).toMatchObject({
      compactValue: "Today",
      compactLabel: "Matures",
      compactExtra: "24 Aug 2026",
    });
    expect(
      resolveNoteTimingDisplay({ tenureDays: null, maturityDate: "2026-08-20T00:00:00.000Z" }, now)
    ).toMatchObject({
      compactValue: "4",
      compactLabel: "days past due",
      filterDays: -4,
    });
  });

  it("treats invalid maturity as pending on tenure notes and unknown on legacy", () => {
    expect(resolveNoteTimingDisplay({ tenureDays: 75, maturityDate: "not-a-date" })).toMatchObject({
      kind: "tenure_pending",
      value: "75 days from disbursement",
      filterDays: 75,
    });
    expect(resolveNoteTimingDisplay({ tenureDays: null, maturityDate: "not-a-date" })).toMatchObject({
      kind: "unknown",
      value: "—",
      filterDays: null,
      sortTime: null,
    });
  });
});

describe("resolveMarketplaceFilterDays", () => {
  it("uses stored tenure for new notes even after a maturity date exists", () => {
    expect(
      resolveMarketplaceFilterDays({
        tenureDays: 90,
        maturityDate: "2026-11-18T00:00:00.000Z",
      })
    ).toBe(90);
    expect(resolveMarketplaceFilterDays({ tenureDays: 45, maturityDate: null })).toBe(45);
  });
});

describe("compareNoteTimingSort", () => {
  it("sorts unknown dates last, then by tenure, then by id", () => {
    const pending90 = { id: "b", tenureDays: 90, maturityDate: null };
    const pending45 = { id: "a", tenureDays: 45, maturityDate: null };
    const sooner = { id: "c", tenureDays: 90, maturityDate: "2026-09-01T00:00:00.000Z" };
    const later = { id: "d", tenureDays: null, maturityDate: "2026-10-01T00:00:00.000Z" };
    const ordered = [pending90, later, pending45, sooner].sort(compareNoteTimingSort);
    expect(ordered.map((item) => item.id)).toEqual(["c", "d", "a", "b"]);
  });
});

describe("issuer timing copy", () => {
  it("shows tenure and pending maturity as separate facts", () => {
    const pending = resolveNoteTimingDisplay({ tenureDays: 90, maturityDate: null });
    expect(formatIssuerFinancingTenure(pending)).toBe("90 days");
    expect(formatIssuerNoteMaturity(pending)).toBe("Set when funds are disbursed");
    const activated = resolveNoteTimingDisplay({
      tenureDays: 90,
      maturityDate: "2026-11-18T00:00:00.000Z",
    });
    expect(formatIssuerFinancingTenure(activated)).toBe("90 days");
    expect(formatIssuerNoteMaturity(activated)).toBe(formatNoteDateEnMy("2026-11-18T00:00:00.000Z"));
    expect(joinNoteTimingExtra("18 Nov 2026", "90-day tenure")).toBe("18 Nov 2026 · 90-day tenure");
  });

  it("labels issuer countdown as grace instead of overdue during the grace window", () => {
    const now = new Date("2026-08-24T04:00:00.000Z");
    expect(
      formatIssuerMaturityCountdown("2026-08-21T00:00:00.000Z", {
        tenureDays: 90,
        gracePeriodDays: 7,
        now,
      })
    ).toBe("3 days in grace");
    expect(
      formatIssuerMaturityCountdown("2026-08-16T00:00:00.000Z", {
        tenureDays: 90,
        gracePeriodDays: 7,
        now,
      })
    ).toBe("8 days overdue");
    expect(
      formatIssuerMaturityCountdown("2026-08-21T00:00:00.000Z", {
        tenureDays: null,
        now,
      })
    ).toBe("3 days overdue");
  });

  it("does not treat offer tenure as note tenure once a legacy note exists", () => {
    const legacy = resolveIssuerInvoiceNoteTiming({
      note: { tenureDays: null, maturityDate: "2026-09-12T00:00:00.000Z" },
      offerDetails: { financing_tenure_days: 90 },
    });
    expect(legacy?.isTenureNote).toBe(false);
    expect(legacy?.kind).toBe("legacy");
    const preNote = resolveIssuerInvoiceNoteTiming({
      note: null,
      offerDetails: { financing_tenure_days: 90 },
    });
    expect(preNote?.isTenureNote).toBe(true);
    expect(preNote?.kind).toBe("tenure_pending");
  });

  it("keeps marketplace KPI numbers large and dates small", () => {
    expect(isCompactNoteTimingValueShort("90")).toBe(true);
    expect(isCompactNoteTimingValueShort("Today")).toBe(true);
    expect(isCompactNoteTimingValueShort("18 Nov 2026")).toBe(false);
  });
});

describe("shouldLabelExpectedReturnAsUpTo", () => {
  it("labels unsettled tenure notes as estimates", () => {
    expect(shouldLabelExpectedReturnAsUpTo({ tenureDays: 90, settled: false })).toBe(true);
    expect(shouldLabelExpectedReturnAsUpTo({ tenureDays: 90, settled: true })).toBe(false);
    expect(shouldLabelExpectedReturnAsUpTo({ tenureDays: null, settled: false })).toBe(false);
  });
});

describe("return and grace tooltips", () => {
  it("explains full-tenure estimate, early stop, and post-grace ceiling", () => {
    expect(EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP).toMatch(/full tenure/);
    expect(EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP).toMatch(/Early settlement/);
    expect(EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP).toMatch(/ceiling/);
    expect(MARKETPLACE_RETURN_RATE_TOOLTIP).toMatch(/before the service fee/);
    expect(NOTE_TIMING_GRACE_TOOLTIP).toMatch(/grace window/);
    expect(NOTE_TIMING_PAST_MATURITY_TOOLTIP).toMatch(/issuer/);
  });
});
