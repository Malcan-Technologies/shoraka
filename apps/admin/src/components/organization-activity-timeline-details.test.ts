import {
  extractOrganizationTimelineBylineChips,
  extractOrganizationTimelineCompactDetails,
} from "./organization-activity-timeline-details";

describe("extractOrganizationTimelineBylineChips", () => {
  it("returns empty when metadata is missing", () => {
    expect(extractOrganizationTimelineBylineChips(null)).toEqual([]);
  });

  it("prefers resolved names for Updated/Approved/Cancelled/Reset by", () => {
    expect(
      extractOrganizationTimelineBylineChips({
        approvedBy: "user-1",
        approvedByName: "Aisha Rahman",
        cancelledBy: "user-2",
        cancelledByName: "Ben Tan",
        updatedBy: "user-3",
        updatedByName: "Chen Wei",
        resetBy: "user-4",
        resetByName: "Dana Lim",
      })
    ).toEqual([
      { label: "Approved by", name: "Aisha Rahman" },
      { label: "Cancelled by", name: "Ben Tan" },
      { label: "Updated by", name: "Chen Wei" },
      { label: "Reset by", name: "Dana Lim" },
    ]);
  });

  it("falls back to Admin when the name is missing", () => {
    expect(
      extractOrganizationTimelineBylineChips({
        updatedBy: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      })
    ).toEqual([{ label: "Updated by", name: "Admin" }]);
  });

  it("skips empty actor ids", () => {
    expect(extractOrganizationTimelineBylineChips({ updatedBy: "", approvedBy: null })).toEqual([]);
  });
});

describe("extractOrganizationTimelineCompactDetails", () => {
  it("keeps status and risk fields and drops page-context type chips", () => {
    expect(
      extractOrganizationTimelineCompactDetails("ONBOARDING_STATUS_UPDATED", {
        previousStatus: "SUBMITTED",
        newStatus: "APPROVED",
        riskLevel: "LOW",
        riskScore: 12,
        updatedBy: "user-3",
        updatedByName: "Chen Wei",
        portalType: "ISSUER",
        organizationType: "COMPANY",
      })
    ).toEqual([
      { label: "Status", value: "SUBMITTED → APPROVED" },
      { label: "Risk", value: "LOW" },
      { label: "Score", value: "12" },
    ]);
  });
});
