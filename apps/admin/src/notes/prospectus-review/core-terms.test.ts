jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import fs from "node:fs";
import path from "node:path";
import {
  PROSPECTUS_FIXED_PAYMENT_BASIS,
  PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
  calculateCalendarDayCount,
  type NoteDetail,
} from "@cashsouk/types";
import {
  appendIssuerTrackRecordSection,
  buildNoteInvestmentDetailSections,
  resolveCatalogueOptionLabel,
} from "./core-terms";

function sampleNote(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    id: "note-1",
    noteReference: "PROSPECTUS-DEMO-001",
    title: "Demo Note",
    productCategory: "Invoice Financing",
    productName: "Invoice Financing",
    issuerIndustry: "Construction",
    sourceApplicationId: "app-1",
    sourceApplicationDisplayReference: null,
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: null,
    sourceInvoiceDisplayReference: null,
    issuerOrganizationId: "org-1",
    issuerOrganizationDisplayReference: null,
    issuerName: "Hidden Issuer Sdn Bhd",
    paymasterName: "Kementerian Kerja Raya",
    riskRating: "SME-3",
    status: "DRAFT",
    listingStatus: "UNPUBLISHED",
    fundingStatus: "NOT_OPEN",
    servicingStatus: "NOT_STARTED",
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    investorCount: 0,
    maturityDate: "2026-12-31T00:00:00.000Z",
    listingClosesAt: "2026-08-01T00:00:00.000Z",
    activatedAt: null,
    publishedAt: null,
    settlementSummary: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    targetAmount: 500_000,
    fundedAmount: 0,
    fundingPercent: 0,
    minimumFundingPercent: 0,
    requestedAmount: 500_000,
    invoiceAmount: 500_000,
    settlementAmount: 0,
    profitRatePercent: 10,
    platformFeeRatePercent: 0,
    serviceFeeRatePercent: 20,
    productSnapshot: {
      product_name: "Invoice Financing",
      description: "Short-term invoice financing note",
    },
    purposeSnapshot: { financing_for: "Working capital" },
    prospectusSnapshot: null,
    issuerSnapshot: {
      industry: "Construction",
      entity_type: "Sdn Bhd",
      country: "Malaysia",
      business_description: "Infrastructure contractor",
      company_name: "Hidden Issuer Sdn Bhd",
      registration_number: "1234567-A",
    },
    paymasterSnapshot: {
      name: "Kementerian Kerja Raya",
      entity_type: "Government Ministry",
    },
    contractSnapshot: null,
    invoiceSnapshot: null,
    serviceFeeCustomerScope: null,
    gracePeriodDays: 0,
    arrearsThresholdDays: 0,
    tawidhRateCapPercent: 0,
    gharamahRateCapPercent: 0,
    defaultMarkedAt: null,
    defaultReason: null,
    listing: {
      id: "listing-1",
      noteId: "note-1",
      status: "UNPUBLISHED",
      opensAt: "2026-07-15T00:00:00.000Z",
      closesAt: "2026-08-01T00:00:00.000Z",
      publishedAt: null,
      unpublishedAt: null,
      visibility: "PUBLIC",
      summary: null,
      riskDisclosure: null,
    },
    investments: [],
    paymentSchedules: [],
    payments: [],
    settlements: [],
    withdrawals: [],
    events: [],
    ...overrides,
  } as NoteDetail;
}

describe("note & investment details coverage", () => {
  it("builds the approved Page 1 section groups", () => {
    const sections = buildNoteInvestmentDetailSections(sampleNote());
    expect(sections.map((s) => s.title)).toEqual([
      "Note Details",
      "Dates & Paymaster",
      "Investment Summary",
      "Risk Information",
      "At a Glance",
    ]);
    expect(sections.map((s) => s.title)).not.toContain("Investment Terms");
  });

  it("appends Issuer Track Record after At a Glance from API rows", () => {
    const base = buildNoteInvestmentDetailSections(sampleNote());
    const trackRows = [
      { label: "Total Notes Funded — All Time", value: "0" },
      { label: "Total Amount Funded — All Time", value: "RM 0.00" },
      { label: "Successful Repayment — All Time", value: "—" },
      {
        label: "On-time Payment Rate — Last 6 Months",
        value: "—",
      },
    ];
    const sections = appendIssuerTrackRecordSection(base, trackRows);
    expect(sections.map((s) => s.title)).toEqual([
      "Note Details",
      "Dates & Paymaster",
      "Investment Summary",
      "Risk Information",
      "At a Glance",
      "Issuer Track Record",
    ]);
    const glance = sections.find((s) => s.id === "at-a-glance");
    expect(glance?.rows.map((r) => r.label)).toEqual([
      "Financing Amount",
      "Profit Rate (p.a.)",
      "Expected Return (p.a.)",
      "Tenure",
      "Minimum Investment",
    ]);
    const track = sections.find((s) => s.id === "issuer-track-record")!;
    expect(track.title).toBe("Issuer Track Record");
    expect(track.rows).toEqual(trackRows);
    expect(track.rows.map((r) => r.label)).toEqual([
      "Total Notes Funded — All Time",
      "Total Amount Funded — All Time",
      "Successful Repayment — All Time",
      "On-time Payment Rate — Last 6 Months",
    ]);
    expect(track.rows.find((r) => r.label === "Total Notes Funded — All Time")?.value).toBe(
      "0"
    );
    expect(
      track.rows.find((r) => r.label === "Total Amount Funded — All Time")?.value
    ).toBe("RM 0.00");
    expect(track.rows.find((r) => r.label === "Successful Repayment — All Time")?.value).toBe(
      "—"
    );
    expect(
      track.rows.find((r) => r.label === "On-time Payment Rate — Last 6 Months")?.value
    ).toBe("—");
  });

  it("does not append Issuer Track Record when API rows are missing", () => {
    const base = buildNoteInvestmentDetailSections(sampleNote());
    expect(appendIssuerTrackRecordSection(base, undefined).map((s) => s.id)).not.toContain(
      "issuer-track-record"
    );
    expect(appendIssuerTrackRecordSection(base, []).map((s) => s.id)).not.toContain(
      "issuer-track-record"
    );
  });

  it("titles the investment section Investment Summary with the approved field set", () => {
    const section = buildNoteInvestmentDetailSections(sampleNote()).find(
      (s) => s.id === "investment-terms"
    )!;
    expect(section.title).toBe("Investment Summary");
    expect(section.rows.map((r) => r.label)).toEqual([
      "Financing Amount",
      "Minimum Investment",
      "Profit Rate (p.a.)",
      "Expected Return (p.a.)",
      "Tenure",
      "Purpose of Financing",
      "Payment Basis",
      "Shariah Principle",
    ]);
  });

  it("does not invent Issuer Track Record, Historical Notes, or Issuer Profile in local core sections", () => {
    const sections = buildNoteInvestmentDetailSections(sampleNote());
    expect(sections.map((s) => s.id)).not.toContain("issuer-track-record");
    expect(sections.map((s) => s.id)).not.toContain("historical-notes");
    expect(sections.map((s) => s.id)).not.toContain("issuer-profile");
    const labels = sections.flatMap((s) => s.rows.map((r) => r.label)).join("\n");
    expect(labels).not.toMatch(/verify in Preview/i);
    expect(labels).not.toMatch(/Total Notes Funded|Total Amount Funded/);
    expect(labels).not.toMatch(/^Industry$|^Entity Type$|^Company Size$/m);
  });

  it("shows Profit Rate and Expected Return as separate investment fields", () => {
    const sections = buildNoteInvestmentDetailSections(sampleNote());
    const terms = sections.find((s) => s.id === "investment-terms")!.rows;
    const profit = terms.find((r) => r.label === "Profit Rate (p.a.)");
    const expected = terms.find((r) => r.label === "Expected Return (p.a.)");
    expect(profit?.value).toBeTruthy();
    expect(expected?.value).toBeTruthy();
    expect(profit?.label).not.toBe(expected?.label);
    expect(profit?.value).not.toBe(expected?.value);
  });

  it("covers Note Details, dates, paymaster, purpose, and risk rating", () => {
    const sections = buildNoteInvestmentDetailSections(sampleNote());
    const byId = Object.fromEntries(sections.map((s) => [s.id, s.rows]));
    expect(byId["note-details"]?.map((r) => r.label)).toEqual([
      "Note Reference",
      "Financing Type",
      "Product Description",
    ]);
    expect(byId["note-details"]?.find((r) => r.label === "Product Description")?.value).toContain(
      "invoice financing note"
    );
    expect(byId["dates-paymaster"]?.map((r) => r.label)).toEqual([
      "Listing Date",
      "Closing Date",
      "Maturity Date",
      "Tenure",
      "Paymaster",
      "Nature of Paymaster",
    ]);
    expect(byId["dates-paymaster"]?.find((r) => r.label === "Nature of Paymaster")?.value).toBe(
      "Government Ministry"
    );
    expect(byId["investment-terms"]?.map((r) => r.label)).toEqual([
      "Financing Amount",
      "Minimum Investment",
      "Profit Rate (p.a.)",
      "Expected Return (p.a.)",
      "Tenure",
      "Purpose of Financing",
      "Payment Basis",
      "Shariah Principle",
    ]);
    expect(byId["investment-terms"]?.find((r) => r.label === "Purpose of Financing")?.value).toBe(
      "Working capital"
    );
    expect(byId["risk-information"]?.map((r) => r.label)).toEqual([
      "Risk Rating",
      "Risk Label",
      "Risk Explanation",
    ]);
    expect(byId["risk-information"]?.find((r) => r.label === "Risk Rating")?.value).toBe("SME-3");
  });

  it("keeps Risk Rating, Label, and Explanation; omits Rating Scale Reference from admin", () => {
    const withGrade = buildNoteInvestmentDetailSections(sampleNote({ riskRating: "SME-5" }));
    const risk = withGrade.find((s) => s.id === "risk-information")!;
    expect(risk.title).toBe("Risk Information");
    expect(risk.rows.map((r) => r.label)).toEqual([
      "Risk Rating",
      "Risk Label",
      "Risk Explanation",
    ]);
    expect(risk.rows.find((r) => r.label === "Risk Rating")?.value).toBe("SME-5");
    expect(risk.rows.find((r) => r.label === "Risk Label")?.value).toBe("Moderate Risk");
    expect(risk.rows.find((r) => r.label === "Risk Explanation")?.value).toBe(
      "Moderate credit strength with moderate non-repayment risk"
    );
    expect(risk.rows.some((r) => r.label === "Rating Scale Reference")).toBe(false);
    expect(JSON.stringify(risk.rows)).not.toMatch(/See rating scale on page 2/);
    expect(JSON.stringify(risk.rows)).not.toContain("typical SME and transaction-level risks");

    const letter = buildNoteInvestmentDetailSections(
      sampleNote({ riskRating: "C" as never })
    ).find((s) => s.id === "risk-information")!.rows;
    expect(letter.find((r) => r.label === "Risk Rating")?.value).toBe("—");
    expect(letter.find((r) => r.label === "Risk Label")?.value).toBe("—");
    expect(letter.find((r) => r.label === "Risk Explanation")?.value).toBe("—");

    const missing = buildNoteInvestmentDetailSections(sampleNote({ riskRating: null })).find(
      (s) => s.id === "risk-information"
    )!.rows;
    expect(missing.find((r) => r.label === "Risk Rating")?.value).toBe("—");
    expect(missing.find((r) => r.label === "Risk Label")?.value).toBe("—");
    expect(missing.find((r) => r.label === "Risk Explanation")?.value).toBe("—");

    const invalid = buildNoteInvestmentDetailSections(
      sampleNote({ riskRating: "AAA" as never })
    ).find((s) => s.id === "risk-information")!.rows;
    expect(invalid.find((r) => r.label === "Risk Rating")?.value).toBe(
      "—"
    );
  });

  it("repeats the five At a Glance values and keeps issuer identity hidden", () => {
    const sections = buildNoteInvestmentDetailSections(sampleNote());
    const glance = sections.find((s) => s.id === "at-a-glance")!.rows;
    expect(glance.map((r) => r.label)).toEqual([
      "Financing Amount",
      "Profit Rate (p.a.)",
      "Expected Return (p.a.)",
      "Tenure",
      "Minimum Investment",
    ]);
    const flat = sections.flatMap((s) => s.rows.map((r) => `${r.label}:${r.value}`)).join("\n");
    expect(flat).not.toMatch(/Hidden Issuer|1234567-A|registration/i);
  });

  it("shows fixed Payment Basis and Shariah Principle from shared constants", () => {
    expect(resolveCatalogueOptionLabel([{ key: "a", label: "Bullet" }], "a")).toBe("Bullet");
    expect(resolveCatalogueOptionLabel([], null)).toBe("Not selected");
    const terms = buildNoteInvestmentDetailSections(sampleNote()).find(
      (s) => s.id === "investment-terms"
    )!.rows;
    expect(terms.find((r) => r.label === "Payment Basis")?.value).toBe(
      PROSPECTUS_FIXED_PAYMENT_BASIS
    );
    expect(terms.find((r) => r.label === "Shariah Principle")?.value).toBe(
      PROSPECTUS_FIXED_SHARIAH_PRINCIPLE
    );
    expect(terms.find((r) => r.label === "Payment Basis")?.value).toBe(
      "Bullet Payment at Maturity"
    );
    expect(terms.find((r) => r.label === "Shariah Principle")?.value).toBe(
      "Bai' Al-Dayn Bi Al-Sila'"
    );
    expect(terms.find((r) => r.label === "Payment Basis")?.value).not.toBe("Not selected");
    expect(terms.find((r) => r.label === "Shariah Principle")?.value).not.toBe(
      "—"
    );

    const source = fs.readFileSync(path.join(__dirname, "core-terms.ts"), "utf8");
    expect(source).toContain("PROSPECTUS_FIXED_PAYMENT_BASIS");
    expect(source).toContain("PROSPECTUS_FIXED_SHARIAH_PRINCIPLE");
    expect(source).not.toContain("paymentBasisLabel");
    expect(source).not.toMatch(/Payment Basis[\s\S]{0,80}Not selected/);
  });

  it("shows — for missing Purpose of Financing without Application fallback", () => {
    const terms = buildNoteInvestmentDetailSections(
      sampleNote({ purposeSnapshot: null })
    ).find((s) => s.id === "investment-terms")!.rows;
    expect(terms.find((r) => r.label === "Purpose of Financing")?.value).toBe(
      "—"
    );

    const blank = buildNoteInvestmentDetailSections(
      sampleNote({ purposeSnapshot: { financing_for: "   " } })
    ).find((s) => s.id === "investment-terms")!.rows;
    expect(blank.find((r) => r.label === "Purpose of Financing")?.value).toBe(
      "—"
    );

    const source = fs.readFileSync(path.join(__dirname, "core-terms.ts"), "utf8");
    expect(source).not.toMatch(/liveApplicationFinancingFor|liveApplication/);
    expect(source).toContain("purpose?.financing_for");
    expect(source).toContain('title: "Investment Summary"');
    expect(source).not.toContain('title: "Investment Terms"');
  });
});

describe("Investment Summary Tenure (Maturity Date remains under Dates & Paymaster)", () => {
  function sectionRows(note: NoteDetail, id: string) {
    return buildNoteInvestmentDetailSections(note).find((s) => s.id === id)!.rows;
  }

  function value(rows: Array<{ label: string; value: string }>, label: string) {
    return rows.find((r) => r.label === label)?.value;
  }

  it("includes Tenure in the approved Investment Summary order without Maturity Date", () => {
    expect(sectionRows(sampleNote(), "investment-terms").map((r) => r.label)).toEqual([
      "Financing Amount",
      "Minimum Investment",
      "Profit Rate (p.a.)",
      "Expected Return (p.a.)",
      "Tenure",
      "Purpose of Financing",
      "Payment Basis",
      "Shariah Principle",
    ]);
  });

  it("keeps Tenure and Maturity Date under Dates & Paymaster", () => {
    const dates = sectionRows(sampleNote(), "dates-paymaster");
    expect(dates.map((r) => r.label)).toEqual([
      "Listing Date",
      "Closing Date",
      "Maturity Date",
      "Tenure",
      "Paymaster",
      "Nature of Paymaster",
    ]);
    expect(value(dates, "Tenure")).toBeTruthy();
    expect(value(dates, "Maturity Date")).toBeTruthy();
  });

  it("keeps Tenure in Investment Summary without duplicating Maturity Date", () => {
    const note = sampleNote();
    const dates = sectionRows(note, "dates-paymaster");
    const summary = sectionRows(note, "investment-terms");
    expect(value(summary, "Tenure")).toBe(value(dates, "Tenure"));
    expect(value(summary, "Maturity Date")).toBeUndefined();
  });

  it("uses calculateCalendarDayCount and formatUtcCalendarDateEnMy without a second tenure formula", () => {
    const opensAt = "2025-05-15T00:00:00.000Z";
    const maturityDate = "2025-09-12T00:00:00.000Z";
    const expectedDays = calculateCalendarDayCount(
      new Date(opensAt),
      new Date(maturityDate)
    );
    expect(expectedDays).toBe(120);

    const base = sampleNote();
    const summary = sectionRows(
      sampleNote({
        listing: {
          ...base.listing!,
          opensAt,
          closesAt: "2025-05-30T00:00:00.000Z",
        },
        maturityDate,
      }),
      "investment-terms"
    );
    expect(value(summary, "Tenure")).toBe("120 days");
    expect(value(summary, "Maturity Date")).toBeUndefined();

    const source = fs.readFileSync(path.join(__dirname, "core-terms.ts"), "utf8");
    expect(source).toContain("calculateCalendarDayCount");
    expect(source).toContain("formatUtcCalendarDateEnMy");
    expect(source).toContain("formatProspectusAlignedTenure");
    expect(source).not.toMatch(/Math\.round\([\s\S]*86_?400_?000/);
    expect(source).not.toMatch(/daysLeft|investorDays|differenceInCalendarDays/);
  });

  it("shows — for missing Tenure in Investment Summary", () => {
    const base = sampleNote();
    const summary = sectionRows(
      sampleNote({
        listing: {
          ...base.listing!,
          opensAt: null,
        },
        maturityDate: null,
      }),
      "investment-terms"
    );
    expect(value(summary, "Tenure")).toBe("—");
    expect(value(summary, "Maturity Date")).toBeUndefined();
  });

  it("uses stored tenure and from-disbursement copy for new notes before activation", () => {
    const rows = sectionRows(
      sampleNote({ tenureDays: 90, maturityDate: null }),
      "dates-paymaster"
    );
    expect(value(rows, "Tenure")).toBe("90 days");
    expect(value(rows, "Maturity Date")).toBe("90 days from disbursement");
  });
});

describe("Dates & Paymaster prospectus alignment", () => {
  function datesRows(note: NoteDetail) {
    return buildNoteInvestmentDetailSections(note).find((s) => s.id === "dates-paymaster")!.rows;
  }

  function value(rows: Array<{ label: string; value: string }>, label: string) {
    return rows.find((r) => r.label === label)?.value;
  }

  it("keeps all six fields in the approved order", () => {
    expect(datesRows(sampleNote()).map((r) => r.label)).toEqual([
      "Listing Date",
      "Closing Date",
      "Maturity Date",
      "Tenure",
      "Paymaster",
      "Nature of Paymaster",
    ]);
  });

  it("uses listing.opensAt only and does not fall back to publishedAt or createdAt", () => {
    const rows = datesRows(
      sampleNote({
        listing: null,
        listingClosesAt: null,
        publishedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2025-12-01T00:00:00.000Z",
      })
    );
    expect(value(rows, "Listing Date")).toBe("—");
    expect(value(rows, "Listing Date")).not.toContain("2026");
    expect(value(rows, "Listing Date")).not.toContain("2025");
  });

  it("formats Listing, Closing, and Maturity dates with UTC calendar parts", () => {
    const base = sampleNote();
    const rows = datesRows(
      sampleNote({
        listing: {
          ...base.listing!,
          opensAt: "2025-05-15T00:00:00.000Z",
          closesAt: "2025-05-30T00:00:00.000Z",
        },
        maturityDate: "2025-09-12T00:00:00.000Z",
      })
    );
    expect(value(rows, "Listing Date")).toBe("15 May 2025");
    expect(value(rows, "Closing Date")).toBe("30 May 2025");
    expect(value(rows, "Maturity Date")).toBe("12 September 2025");
    expect(value(rows, "Closing Date")).not.toMatch(/\(\d+ days\)/);
    expect(value(rows, "Maturity Date")).not.toMatch(/\(/);
  });

  it("does not shift UTC midnight-boundary timestamps to the next local calendar day", () => {
    const base = sampleNote();
    const rows = datesRows(
      sampleNote({
        listing: {
          ...base.listing!,
          opensAt: "2026-01-01T20:00:00.000Z",
          closesAt: "2026-01-14T20:00:00.000Z",
        },
        maturityDate: "2026-04-01T02:00:00.000Z",
      })
    );
    expect(value(rows, "Listing Date")).toBe("1 January 2026");
    expect(value(rows, "Closing Date")).toBe("14 January 2026");
    expect(value(rows, "Maturity Date")).toBe("1 April 2026");
  });

  it("computes Tenure with calculateCalendarDayCount matching Page 1 prospectus", () => {
    const opensAt = "2025-05-15T00:00:00.000Z";
    const maturityDate = "2025-09-12T00:00:00.000Z";
    const expectedDays = calculateCalendarDayCount(
      new Date(opensAt),
      new Date(maturityDate)
    );
    expect(expectedDays).toBe(120);

    const base = sampleNote();
    const rows = datesRows(
      sampleNote({
        listing: {
          ...base.listing!,
          opensAt,
          closesAt: "2025-05-30T00:00:00.000Z",
        },
        maturityDate,
      })
    );
    expect(value(rows, "Tenure")).toBe(`${expectedDays} days`);
    expect(value(rows, "Tenure")).toBe("120 days");
  });

  it("matches prospectus tenure across a timezone-boundary pair (not investor days-left)", () => {
    const opensAt = "2026-01-01T20:00:00.000Z";
    const maturityDate = "2026-04-01T02:00:00.000Z";
    const prospectusDays = calculateCalendarDayCount(
      new Date(opensAt),
      new Date(maturityDate)
    );
    const adminRoundDays = Math.round(
      (new Date(maturityDate).getTime() - new Date(opensAt).getTime()) / 86_400_000
    );
    expect(prospectusDays).toBe(90);
    expect(adminRoundDays).toBe(89);

    const base = sampleNote();
    const rows = datesRows(
      sampleNote({
        listing: {
          ...base.listing!,
          opensAt,
          closesAt: "2026-01-14T20:00:00.000Z",
        },
        maturityDate,
      })
    );
    expect(value(rows, "Tenure")).toBe("90 days");
    expect(value(rows, "Tenure")).not.toBe(`${adminRoundDays} days`);
  });

  it("shows — for missing tenure inputs, paymaster, and nature", () => {
    const base = sampleNote();
    const rows = datesRows(
      sampleNote({
        listing: {
          ...base.listing!,
          opensAt: null,
          closesAt: null,
        },
        listingClosesAt: null,
        maturityDate: null,
        paymasterName: null,
        paymasterSnapshot: {},
      })
    );
    expect(value(rows, "Listing Date")).toBe("—");
    expect(value(rows, "Closing Date")).toBe("—");
    expect(value(rows, "Maturity Date")).toBe("—");
    expect(value(rows, "Tenure")).toBe("—");
    expect(value(rows, "Paymaster")).toBe("—");
    expect(value(rows, "Nature of Paymaster")).toBe("—");
  });
});

describe("Risk Information prospectus/admin boundary", () => {
  it("keeps See rating scale on page 2 on Page 1 prospectus only", () => {
    const riskTypes = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../api/src/modules/notes/prospectus/prospectus-risk-assessment.types.ts"
      ),
      "utf8"
    );
    const pageOneHtml = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../api/src/modules/notes/prospectus/prospectus-page-one.html.ts"
      ),
      "utf8"
    );
    expect(riskTypes).toContain('PROSPECTUS_RATING_SCALE_REFERENCE = "See rating scale on page 2"');
    expect(pageOneHtml).toContain("ratingScaleReference");

    const adminCore = fs.readFileSync(path.join(__dirname, "core-terms.ts"), "utf8");
    expect(adminCore).not.toContain("See rating scale on page 2");
    expect(adminCore).not.toContain('label: "Rating Scale Reference"');
  });

  it("resolves grade-to-label and explanation from the shared catalogue in admin", () => {
    const adminCore = fs.readFileSync(path.join(__dirname, "core-terms.ts"), "utf8");
    expect(adminCore).toContain("resolveMarcNoteRiskPresentation");
    expect(adminCore).not.toContain('label: "Risk Label", value: DATA_NOT_AVAILABLE');
    expect(adminCore).not.toContain('label: "Risk Explanation", value: DATA_NOT_AVAILABLE');
  });

  it("keeps Page 2 risk scale non-editable in Prospectus completion rules", () => {
    const pageTwoScale = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../api/src/modules/notes/prospectus/prospectus-soukscore-rating-scale.ts"
      ),
      "utf8"
    );
    expect(pageTwoScale).not.toContain("riskLabel:");
    expect(pageTwoScale).not.toContain("definition:");
    expect(pageTwoScale).not.toContain("assessmentNote:");
    expect(pageTwoScale).toContain("PROSPECTUS_SOUKSCORE_RATING_NOT_AVAILABLE");

    const completion = fs.readFileSync(path.join(__dirname, "completion.ts"), "utf8");
    expect(completion).not.toMatch(/Risk Label|Risk Explanation|Risk Rating|risk-information/);
    expect(completion).toContain('id: "core"');
    expect(completion).toContain("complete: true");
  });
});

