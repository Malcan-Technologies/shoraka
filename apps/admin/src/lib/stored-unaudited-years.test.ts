import {
  adminFinancialSummaryColumns,
  adminFyPeriodLines,
  adminUnauditedYearPresentation,
  comparisonUnauditedGroupHeader,
  extractQuestionnaireAndUnaudited,
  extractQuestionnaireUnauditedAndAdminInput,
  storedUnauditedYears,
} from "./stored-unaudited-years";

describe("storedUnauditedYears", () => {
  it("returns numeric keys sorted ascending and ignores non-year keys", () => {
    expect(storedUnauditedYears({ "2027": {}, "2026": {}, foo: {} })).toEqual([2026, 2027]);
    expect(storedUnauditedYears({})).toEqual([]);
    expect(storedUnauditedYears(null)).toEqual([]);
  });
});

describe("extractQuestionnaireAndUnaudited", () => {
  it("keeps an aged FYE so User Input years come from stored keys", () => {
    const extracted = extractQuestionnaireAndUnaudited({
      questionnaire: { financial_year_end: "2020-12-31" },
      unaudited_by_year: {
        "2019": { turnover: 1 },
        "2020": { turnover: 2 },
      },
    });
    expect(extracted.questionnaire).toEqual({ financial_year_end: "2020-12-31" });
    expect(storedUnauditedYears(extracted.unauditedByYear)).toEqual([2019, 2020]);
  });
});

describe("adminUnauditedYearPresentation", () => {
  const q = { financial_year_end: "2027-05-31" };
  const ref = new Date(2026, 8, 18);

  it("clamps an open year to today and still labels it User Input", () => {
    expect(adminUnauditedYearPresentation(q, 2027, ref)).toEqual({
      periodLine: "1 Jun 2026 – 18 Sep 2026",
      sourceLabel: "User Input",
      isOpen: true,
    });
  });

  it("keeps the full closed year as User Input", () => {
    expect(adminUnauditedYearPresentation(q, 2026, ref)).toEqual({
      periodLine: "1 Jun 2025 – 31 May 2026",
      sourceLabel: "User Input",
      isOpen: false,
    });
  });

  it("shows the full unclamped period for a beyond-window unstarted year", () => {
    const beyondWindowQ = { financial_year_end: "2027-12-31" };
    expect(adminUnauditedYearPresentation(beyondWindowQ, 2027, ref)).toEqual({
      periodLine: "1 Jan 2027 – 31 Dec 2027",
      sourceLabel: "User Input",
      isOpen: false,
    });
  });

  it("splits a period onto two lines at the en dash", () => {
    expect(adminFyPeriodLines("16 Jun 2026 – 18 Sep 2026")).toEqual([
      "16 Jun 2026 –",
      "18 Sep 2026",
    ]);
  });
});

describe("comparisonUnauditedGroupHeader", () => {
  const beforeQ = { financial_year_end: "2027-03-31" };
  const afterQChangedFye = { financial_year_end: "2027-12-31" };
  const ref = new Date(2028, 8, 18);

  it("does not claim a shared FY or period when index-aligned slot years differ", () => {
    expect(
      comparisonUnauditedGroupHeader(
        { beforeYear: "2026", afterYear: "2027" },
        { before: beforeQ, after: afterQChangedFye },
        ref
      )
    ).toEqual({ year: null, periodLine: "" });
  });

  it("formats a leftover before-only year from the before questionnaire, not after", () => {
    expect(
      comparisonUnauditedGroupHeader(
        { beforeYear: "2027", afterYear: null },
        { before: beforeQ, after: afterQChangedFye },
        ref
      )
    ).toEqual({
      year: 2027,
      periodLine: "1 Apr 2026 – 31 Mar 2027",
    });
  });

  it("uses the after questionnaire when both columns share the same year", () => {
    expect(
      comparisonUnauditedGroupHeader(
        { beforeYear: "2027", afterYear: "2027" },
        { before: beforeQ, after: afterQChangedFye },
        ref
      )
    ).toEqual({
      year: 2027,
      periodLine: "1 Jan 2027 – 31 Dec 2027",
    });
  });

  it("uses the after snapshot when only afterYear exists", () => {
    expect(
      comparisonUnauditedGroupHeader(
        { beforeYear: null, afterYear: "2027" },
        { before: beforeQ, after: afterQChangedFye },
        ref
      )
    ).toEqual({
      year: 2027,
      periodLine: "1 Jan 2027 – 31 Dec 2027",
    });
  });

  it("keeps index-aligned two-tab→one-tab slots from claiming a shared FY2027", () => {
    const slots = [
      { beforeYear: "2026", afterYear: "2027" },
      { beforeYear: "2027", afterYear: null },
    ];
    expect(
      slots.map((slot) =>
        comparisonUnauditedGroupHeader(slot, { before: beforeQ, after: afterQChangedFye }, ref)
      )
    ).toEqual([
      { year: null, periodLine: "" },
      { year: 2027, periodLine: "1 Apr 2026 – 31 Mar 2027" },
    ]);
  });
});

describe("adminFinancialSummaryColumns", () => {
  const stored = { "2026": { turnover: 1 }, "2027": { turnover: 2 } };
  const adminStored = {};
  const eligible: number[] = [];

  it("shows stored issuer years chronologically without empty CTOS pads", () => {
    expect(adminFinancialSummaryColumns([], stored, adminStored, eligible)).toEqual([
      { kind: "unaudited", year: 2026 },
      { kind: "unaudited", year: 2027 },
    ]);
  });

  it("sorts CTOS and non-overlapping issuer years chronologically", () => {
    expect(
      adminFinancialSummaryColumns(
        [{ financial_year: 2024 }, { financial_year: 2025 }],
        stored,
        adminStored,
        eligible
      )
    ).toEqual([
      { kind: "ctos", year: 2024 },
      { kind: "ctos", year: 2025 },
      { kind: "unaudited", year: 2026 },
      { kind: "unaudited", year: 2027 },
    ]);
  });

  it("hides a stored issuer year that matches a CTOS financial_year", () => {
    expect(
      adminFinancialSummaryColumns(
        [{ financial_year: 2024 }, { financial_year: 2025 }, { financial_year: 2026 }],
        stored,
        adminStored,
        eligible
      )
    ).toEqual([
      { kind: "ctos", year: 2024 },
      { kind: "ctos", year: 2025 },
      { kind: "ctos", year: 2026 },
      { kind: "unaudited", year: 2027 },
    ]);
  });

  it("hides both issuer years when CTOS already covers them", () => {
    expect(
      adminFinancialSummaryColumns(
        [{ financial_year: 2025 }, { financial_year: 2026 }, { financial_year: 2027 }],
        stored,
        adminStored,
        eligible
      )
    ).toEqual([
      { kind: "ctos", year: 2025 },
      { kind: "ctos", year: 2026 },
      { kind: "ctos", year: 2027 },
    ]);
  });

  it("places a missing FY placeholder in chronological position", () => {
    const issuerOnly = { "2026": { turnover: 1 } };
    const eligibleMissing = [2025];
    expect(
      adminFinancialSummaryColumns(
        [{ financial_year: 2023 }, { financial_year: 2024 }],
        issuerOnly,
        {},
        eligibleMissing
      )
    ).toEqual([
      { kind: "ctos", year: 2023 },
      { kind: "ctos", year: 2024 },
      { kind: "admin_fallback_placeholder", year: 2025 },
      { kind: "unaudited", year: 2026 },
    ]);
  });

  it("places stored admin_input_by_year in chronological position", () => {
    const issuerOnly = { "2026": { turnover: 1 } };
    const adminInput = {
      "2025": { turnover: 999, statementType: "AUDITED" },
    };
    expect(
      adminFinancialSummaryColumns(
        [{ financial_year: 2023 }, { financial_year: 2024 }],
        issuerOnly,
        adminInput,
        []
      )
    ).toEqual([
      { kind: "ctos", year: 2023 },
      { kind: "ctos", year: 2024 },
      { kind: "admin_input", year: 2025, statementType: "AUDITED" },
      { kind: "unaudited", year: 2026 },
    ]);
  });
});

describe("extractQuestionnaireUnauditedAndAdminInput", () => {
  it("extracts admin_input_by_year alongside unaudited_by_year", () => {
    const extracted = extractQuestionnaireUnauditedAndAdminInput({
      questionnaire: { financial_year_end: "2020-12-31" },
      unaudited_by_year: {
        "2020": { turnover: 2 },
      },
      admin_input_by_year: {
        "2025": { turnover: 999, statementType: "AUDITED" },
      },
    });
    expect(extracted.questionnaire).toEqual({ financial_year_end: "2020-12-31" });
    expect(extracted.unauditedByYear).toEqual({ "2020": { turnover: 2 } });
    expect(extracted.adminInputByYear).toEqual({
      "2025": { turnover: 999, statementType: "AUDITED" },
    });
  });
});
