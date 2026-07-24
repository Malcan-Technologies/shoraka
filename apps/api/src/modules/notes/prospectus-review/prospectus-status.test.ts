import {
  formatProspectusListBadge,
  getProspectusDisplayStatus,
  normalizeProspectusWorkflowStatus,
} from "@cashsouk/types";

describe("prospectus status helpers", () => {
  it("maps legacy statuses to Draft", () => {
    expect(normalizeProspectusWorkflowStatus("READY_FOR_REVIEW")).toBe("DRAFT");
    expect(normalizeProspectusWorkflowStatus("SUPERSEDED")).toBe("DRAFT");
    expect(normalizeProspectusWorkflowStatus("APPROVED")).toBe("APPROVED");
    expect(normalizeProspectusWorkflowStatus("PUBLISHED")).toBe("PUBLISHED");
  });

  it("exposes only Draft | Approved | Published labels", () => {
    expect(
      getProspectusDisplayStatus({ reviewStatus: "READY_FOR_REVIEW", notePublished: false })
    ).toBe("Draft");
    expect(getProspectusDisplayStatus({ reviewStatus: "APPROVED", notePublished: false })).toBe(
      "Approved"
    );
    expect(getProspectusDisplayStatus({ reviewStatus: "PUBLISHED", notePublished: true })).toBe(
      "Published"
    );
    expect(formatProspectusListBadge("Draft")).toBe("Prospectus Draft");
    expect(formatProspectusListBadge("Approved")).toBe("Prospectus Approved");
    expect(formatProspectusListBadge("Published")).toBe("Prospectus Published");
  });
});
