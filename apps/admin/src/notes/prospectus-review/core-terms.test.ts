jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import type { NoteDetail } from "@cashsouk/types";
import {
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
    sourceContractId: null,
    sourceInvoiceId: null,
    issuerOrganizationId: "org-1",
    issuerName: "Hidden Issuer Sdn Bhd",
    paymasterName: "Kementerian Kerja Raya",
    riskRating: "AA",
    status: "DRAFT",
    listingStatus: "UNPUBLISHED",
    fundingStatus: "NOT_OPEN",
    servicingStatus: "NOT_STARTED",
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
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
    const sections = buildNoteInvestmentDetailSections(sampleNote(), {
      paymentBasisLabel: "Bullet at maturity",
      shariahPrincipleLabel: "Commodity Murabahah",
    });
    expect(sections.map((s) => s.title)).toEqual([
      "Note Details",
      "Dates & Paymaster",
      "Investment Terms",
      "Risk Information",
      "At a Glance",
      "Issuer Track Record & Historical Notes",
    ]);
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
    expect(byId["investment-terms"]?.find((r) => r.label === "Purpose of Financing")?.value).toBe(
      "Working capital"
    );
    expect(byId["risk-information"]?.find((r) => r.label === "Risk Rating")?.value).toBe("AA");
    expect(byId["risk-information"]?.find((r) => r.label === "Risk Label")?.value).toBe(
      "Data not available"
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

  it("shows resolved Payment Basis and Shariah Principle without inventing wording", () => {
    expect(resolveCatalogueOptionLabel([{ key: "a", label: "Bullet" }], "a")).toBe("Bullet");
    expect(resolveCatalogueOptionLabel([], null)).toBe("Not selected");
    const sections = buildNoteInvestmentDetailSections(sampleNote(), {
      paymentBasisLabel: "Bullet at maturity",
      shariahPrincipleLabel: "Commodity Murabahah",
    });
    const terms = sections.find((s) => s.id === "investment-terms")!.rows;
    expect(terms.find((r) => r.label === "Payment Basis")?.value).toBe("Bullet at maturity");
    expect(terms.find((r) => r.label === "Shariah Principle")?.value).toBe("Commodity Murabahah");
  });
});
