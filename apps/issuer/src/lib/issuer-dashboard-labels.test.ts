import {
  financingKindToStatusToken,
  resolveIssuerInvoiceDashboardBadge,
} from "./issuer-dashboard-labels";
import type { IssuerDashboardNote } from "@/types/issuer-dashboard";

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
    expect(resolveIssuerInvoiceDashboardBadge(note({ servicingStatus: "CURRENT" }), "APPROVED")).toBe(
      "active"
    );
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
