import { addMytCalendarDays, mytCalendarParts } from "@cashsouk/types";
import { invoiceDetailsSchema } from "./schemas";

function ymdDaysFromNow(days: number): string {
  const parts = addMytCalendarDays(mytCalendarParts(new Date()), days);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function details(overrides: Record<string, unknown> = {}) {
  return {
    number: "INV-1",
    value: 10_000,
    financing_ratio_percent: 70,
    company_category: "TECHNOLOGY",
    campaign_sector: "MANUFACTURING",
    sustainability_category: "G8",
    ...overrides,
  };
}

describe("invoiceDetailsSchema financing tenure", () => {
  const soonDue = ymdDaysFromNow(20);
  const midDue = ymdDaysFromNow(60);

  it("accepts published options that cover the due date", () => {
    expect(
      invoiceDetailsSchema.safeParse(details({ maturity_date: soonDue, financing_tenure_days: 30 }))
        .success
    ).toBe(true);
    expect(
      invoiceDetailsSchema.safeParse(details({ maturity_date: midDue, financing_tenure_days: 90 }))
        .success
    ).toBe(true);
    expect(
      invoiceDetailsSchema.safeParse(details({ maturity_date: midDue, financing_tenure_days: 180 }))
        .success
    ).toBe(true);
  });

  it("rejects an invalid step, missing tenure, and tenure shorter than remaining days", () => {
    expect(
      invoiceDetailsSchema.safeParse(details({ maturity_date: midDue, financing_tenure_days: 40 }))
        .success
    ).toBe(false);
    expect(invoiceDetailsSchema.safeParse(details({ maturity_date: midDue })).success).toBe(false);
    const short = invoiceDetailsSchema.safeParse(
      details({ maturity_date: midDue, financing_tenure_days: 30 })
    );
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues.some((issue) => issue.message.includes("at least"))).toBe(true);
    }
  });

  it("rejects a past invoice due date even with a published tenure", () => {
    const past = invoiceDetailsSchema.safeParse(
      details({ maturity_date: ymdDaysFromNow(-1), financing_tenure_days: 30 })
    );
    expect(past.success).toBe(false);
    if (!past.success) {
      expect(
        past.error.issues.some((issue) => issue.message === "Invoice due date cannot be in the past.")
      ).toBe(true);
    }
    expect(
      invoiceDetailsSchema.safeParse(
        details({ maturity_date: ymdDaysFromNow(0), financing_tenure_days: 30 })
      ).success
    ).toBe(true);
  });
});

describe("invoiceDetailsSchema financing ratio cap", () => {
  const soonDue = ymdDaysFromNow(20);

  it("accepts 80% and rejects 80.01 / 81 / 100", () => {
    expect(
      invoiceDetailsSchema.safeParse(
        details({ maturity_date: soonDue, financing_ratio_percent: 80, financing_tenure_days: 30 })
      ).success
    ).toBe(true);
    for (const ratio of [80.01, 81, 100]) {
      expect(
        invoiceDetailsSchema.safeParse(
          details({
            maturity_date: soonDue,
            financing_ratio_percent: ratio,
            financing_tenure_days: 30,
          })
        ).success
      ).toBe(false);
    }
  });
});

describe("invoiceDetailsSchema campaign classification", () => {
  const soonDue = ymdDaysFromNow(20);

  it("requires Campaign Sector, Company category, and Sustainability Category of the Campaign", () => {
    expect(
      invoiceDetailsSchema.safeParse(
        details({
          maturity_date: soonDue,
          financing_tenure_days: 30,
          campaign_sector: undefined,
        })
      ).success
    ).toBe(false);
    expect(
      invoiceDetailsSchema.safeParse(
        details({
          maturity_date: soonDue,
          financing_tenure_days: 30,
          company_category: undefined,
        })
      ).success
    ).toBe(false);
    expect(
      invoiceDetailsSchema.safeParse(
        details({
          maturity_date: soonDue,
          financing_tenure_days: 30,
          sustainability_category: undefined,
        })
      ).success
    ).toBe(false);
  });

  it("accepts independent Technology / Non-Technology, SC sectors, and 00–G17 values per invoice", () => {
    expect(
      invoiceDetailsSchema.safeParse(
        details({
          maturity_date: soonDue,
          financing_tenure_days: 30,
          company_category: "NON_TECHNOLOGY",
          campaign_sector: "CONSTRUCTIONS",
          sustainability_category: "NONE",
        })
      ).success
    ).toBe(true);
    expect(
      invoiceDetailsSchema.safeParse(
        details({
          number: "INV-2",
          maturity_date: soonDue,
          financing_tenure_days: 30,
          company_category: "TECHNOLOGY",
          campaign_sector: "MANUFACTURING",
          sustainability_category: "G17",
        })
      ).success
    ).toBe(true);
  });
});
