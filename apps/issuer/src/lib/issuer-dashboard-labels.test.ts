import {
  financingKindToStatusToken,
  resolveFundingDisplayFundedAmount,
  resolveFundingProgressPercent,
  resolveFundingStatusText,
  resolveIssuerContractDashboardBadge,
  resolveIssuerInvoiceDashboardBadge,
} from "./issuer-dashboard-labels";
import type { IssuerDashboardNote } from "@/types/issuer-dashboard";

describe("resolveIssuerContractDashboardBadge", () => {
  it("keeps an approved facility active until upfront fee is outstanding", () => {
    expect(resolveIssuerContractDashboardBadge("APPROVED")).toBe("active");
    expect(
      resolveIssuerContractDashboardBadge("APPROVED", { facilityFeeUpfrontOutstanding: 0 })
    ).toBe("active");
    expect(
      resolveIssuerContractDashboardBadge("APPROVED", { facilityFeeUpfrontOutstanding: 2500 })
    ).toBe("action_required");
  });
});

describe("financingKindToStatusToken", () => {
  it("maps viewer-centric colours", () => {
    expect(financingKindToStatusToken("draft")).toBe("neutral");
    expect(financingKindToStatusToken("action_required")).toBe("action");
    expect(financingKindToStatusToken("pending_approval")).toBe("submitted");
    expect(financingKindToStatusToken("pending_listing")).toBe("submitted");
    expect(financingKindToStatusToken("in_progress")).toBe("submitted");
    expect(financingKindToStatusToken("funded")).toBe("submitted");
    expect(financingKindToStatusToken("active")).toBe("active");
    expect(financingKindToStatusToken("completed")).toBe("success");
    expect(financingKindToStatusToken("arrears")).toBe("rejected");
    expect(financingKindToStatusToken("defaulted")).toBe("rejected");
    expect(financingKindToStatusToken("unsuccessful")).toBe("rejected");
  });
});

describe("resolveIssuerInvoiceDashboardBadge arrears/late", () => {
  const note = (overrides: Partial<IssuerDashboardNote>): IssuerDashboardNote => ({
    id: "n1",
    noteReference: "N-1",
    noteStatus: "ACTIVE",
    listingStatus: "PUBLISHED",
    noteListingStatus: "PUBLISHED",
    fundingStatus: "FUNDED",
    servicingStatus: "CURRENT",
    targetAmount: "100",
    fundedAmount: "100",
    fundingProgressPercent: 100,
    minimumFundingPercent: "80",
    fundingDeadline: null,
    maturityDate: null,
    marketplaceStatusLabel: null,
    investorCount: 0,
    disbursementBreakdown: null,
    ...overrides,
  });

  it("maps ARREARS to arrears (red) and LATE to action required", () => {
    expect(resolveIssuerInvoiceDashboardBadge(note({ servicingStatus: "ARREARS" }), "APPROVED")).toBe(
      "arrears"
    );
    expect(resolveIssuerInvoiceDashboardBadge(note({ servicingStatus: "LATE" }), "APPROVED")).toBe(
      "action_required"
    );
    expect(resolveIssuerInvoiceDashboardBadge(note({ servicingStatus: "OVERDUE" }), "APPROVED")).toBe(
      "action_required"
    );
    expect(resolveIssuerInvoiceDashboardBadge(note({ servicingStatus: "CURRENT" }), "APPROVED")).toBe(
      "active"
    );
  });

  it("labels defaulted notes as Defaulted, not Unsuccessful", () => {
    expect(
      resolveIssuerInvoiceDashboardBadge(note({ noteStatus: "DEFAULTED", servicingStatus: "DEFAULTED" }), "APPROVED")
    ).toBe("defaulted");
  });

  it("keeps leftover late charges as action required after settlement", () => {
    expect(
      resolveIssuerInvoiceDashboardBadge(
        note({
          noteStatus: "REPAID",
          servicingStatus: "SETTLED",
          excessLateChargesOutstanding: 80,
        }),
        "APPROVED"
      )
    ).toBe("action_required");
  });
});

describe("resolveIssuerInvoiceDashboardBadge pending listing", () => {
  const unpublishedNote = (overrides: Partial<IssuerDashboardNote> = {}): IssuerDashboardNote => ({
    id: "n1",
    noteReference: "N-1",
    noteStatus: "DRAFT",
    listingStatus: "NOT_LISTED",
    noteListingStatus: "DRAFT",
    fundingStatus: "NOT_OPEN",
    servicingStatus: "NOT_STARTED",
    targetAmount: "100",
    fundedAmount: "0",
    fundingProgressPercent: 0,
    minimumFundingPercent: "80",
    fundingDeadline: null,
    maturityDate: null,
    marketplaceStatusLabel: null,
    investorCount: 0,
    disbursementBreakdown: null,
    ...overrides,
  });

  it("keeps issuer-owned invoice drafts as Draft", () => {
    expect(resolveIssuerInvoiceDashboardBadge(null, "DRAFT")).toBe("draft");
  });

  it("uses Pending listing (blue) while CashSouk prepares the marketplace note", () => {
    expect(resolveIssuerInvoiceDashboardBadge(null, "APPROVED")).toBe("pending_listing");
    expect(resolveIssuerInvoiceDashboardBadge(unpublishedNote(), "APPROVED")).toBe("pending_listing");
    expect(
      resolveIssuerInvoiceDashboardBadge(unpublishedNote({ noteStatus: "DRAFT" }), "APPROVED")
    ).toBe("pending_listing");
    expect(
      resolveIssuerInvoiceDashboardBadge(
        unpublishedNote({ noteStatus: "PUBLISHED", listingStatus: "NOT_LISTED" }),
        "APPROVED"
      )
    ).toBe("pending_listing");
  });
});

describe("fail-funding invoice display", () => {
  const note = (overrides: Partial<IssuerDashboardNote>): IssuerDashboardNote => ({
    id: "n1",
    noteReference: "N-1",
    noteStatus: "ACTIVE",
    listingStatus: "PUBLISHED",
    noteListingStatus: "PUBLISHED",
    fundingStatus: "FUNDED",
    servicingStatus: "CURRENT",
    targetAmount: "8333.33",
    fundedAmount: "400",
    fundingProgressPercent: 5,
    minimumFundingPercent: "80",
    fundingDeadline: null,
    maturityDate: null,
    marketplaceStatusLabel: null,
    investorCount: 1,
    disbursementBreakdown: null,
    ...overrides,
  });

  it("zeros progress so fail-funded copy is Funding did not complete", () => {
    const failed = note({
      noteStatus: "FAILED_FUNDING",
      fundingStatus: "FAILED",
      servicingStatus: "NOT_STARTED",
    });
    expect(resolveFundingProgressPercent(failed)).toBe(0);
    expect(resolveFundingDisplayFundedAmount(failed)).toBe(0);
    expect(resolveFundingStatusText(failed)).toBe("Funding did not complete");
  });

  it("also zeros when note status is FAILED_FUNDING but funding status is CLOSED", () => {
    const failed = note({
      noteStatus: "FAILED_FUNDING",
      fundingStatus: "CLOSED",
      servicingStatus: "NOT_STARTED",
    });
    expect(resolveFundingProgressPercent(failed)).toBe(0);
    expect(resolveFundingStatusText(failed)).toBe("Funding did not complete");
  });

  it("keeps the real raise on open, funded, and repaid notes", () => {
    expect(
      resolveFundingStatusText(
        note({
          noteStatus: "PUBLISHED",
          fundingStatus: "OPEN",
          servicingStatus: "NOT_STARTED",
        })
      )
    ).toBe("Funding status 5% funded (RM 400.00)");
    expect(
      resolveFundingProgressPercent(
        note({
          noteStatus: "ACTIVE",
          fundingStatus: "FUNDED",
          fundedAmount: "8000",
          fundingProgressPercent: 100,
        })
      )
    ).toBe(100);
    expect(
      resolveFundingDisplayFundedAmount(
        note({
          noteStatus: "ACTIVE",
          fundingStatus: "FUNDED",
          fundedAmount: "8000",
          fundingProgressPercent: 100,
        })
      )
    ).toBe(8000);
    expect(
      resolveFundingStatusText(
        note({
          noteStatus: "ACTIVE",
          fundingStatus: "FUNDED",
          fundedAmount: "8000",
          fundingProgressPercent: 100,
        })
      )
    ).toBe("Funding status 100% funded (RM 8,000.00)");
    expect(
      resolveFundingStatusText(
        note({
          noteStatus: "REPAID",
          fundingStatus: "FUNDED",
          servicingStatus: "SETTLED",
          fundedAmount: "8000",
          fundingProgressPercent: 100,
        })
      )
    ).toBe("Funding status 100% funded (RM 8,000.00)");
  });

  it("keeps the real raise on defaulted notes that did fund", () => {
    expect(
      resolveFundingStatusText(
        note({
          noteStatus: "DEFAULTED",
          fundingStatus: "FUNDED",
          servicingStatus: "DEFAULTED",
          fundedAmount: "8000",
          fundingProgressPercent: 100,
        })
      )
    ).toBe("Funding status 100% funded (RM 8,000.00)");
  });
});
