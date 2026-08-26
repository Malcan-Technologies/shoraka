import { mapPublicNoteTiming } from "./public-note-timing";
import type { NoteListItem } from "@cashsouk/types";

function note(overrides: Partial<NoteListItem> = {}): NoteListItem {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    title: "Note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: "Manufacturing",
    sourceApplicationId: "app_1",
    sourceApplicationDisplayReference: null,
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    sourceInvoiceDisplayReference: null,
    issuerOrganizationId: "org_1",
    issuerOrganizationDisplayReference: null,
    issuerName: null,
    paymasterName: null,
    riskRating: "B",
    status: "FUNDING" as NoteListItem["status"],
    listingStatus: "PUBLISHED" as NoteListItem["listingStatus"],
    fundingStatus: "OPEN" as NoteListItem["fundingStatus"],
    servicingStatus: "NOT_STARTED" as NoteListItem["servicingStatus"],
    investorCount: 0,
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    maturityDate: null,
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: "2026-08-01",
    fundingClosedAt: null,
    repaidAt: null,
    settlementSummary: null,
    createdAt: "2026-07-15",
    updatedAt: "2026-08-10",
    requestedAmount: 100000,
    invoiceAmount: 120000,
    settlementAmount: 100000,
    targetAmount: 100000,
    fundedAmount: 32000,
    fundingPercent: 32,
    minimumFundingPercent: 80,
    profitRatePercent: 14.5,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    ...overrides,
  };
}

describe("mapPublicNoteTiming", () => {
  it("maps new notes from stored tenure, not invoice due dates", () => {
    const pending = mapPublicNoteTiming(note({ tenureDays: 90, maturityDate: null }));
    expect(pending.tenorDays).toBe(90);
    expect(pending.timing.value).toBe("90 days from disbursement");
    expect(pending.timing.label).toBe("Financing tenure");
    expect(pending.timing.compactExtra).toBeNull();
    expect(pending.timing.tooltip).toMatch(/from disbursement/);

    const activated = mapPublicNoteTiming(
      note({ tenureDays: 90, maturityDate: "2026-11-18T00:00:00.000Z" })
    );
    expect(activated.tenorDays).toBe(90);
    expect(activated.timing.compactValue).toBe("90");
    expect(activated.timing.compactLabel).toBe("days");
    expect(activated.timing.compactExtra).toMatch(/^Matures /);
    expect(activated.timing.label).toBe("Maturity date");
    expect(activated.timing.secondary).toBe("90-day tenure");
  });

  it("keeps legacy notes on days remaining when tenure is absent", () => {
    const legacy = mapPublicNoteTiming(note({ maturityDate: "2026-09-12T00:00:00.000Z" }));
    expect(legacy.timing.kind).toBe("legacy");
    expect(legacy.tenorDays).toBe(legacy.timing.filterDays);
  });
});
