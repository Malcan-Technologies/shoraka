import {
  formatProspectusListBadge,
  getProspectusDisplayStatus,
  isNoteProspectusPublished,
  normalizeProspectusWorkflowStatus,
} from "@cashsouk/types";

describe("prospectus status helpers", () => {
  const publishedAt = "2026-08-24T00:00:00.000Z";

  it("maps legacy statuses to Draft", () => {
    expect(normalizeProspectusWorkflowStatus("READY_FOR_REVIEW")).toBe("DRAFT");
    expect(normalizeProspectusWorkflowStatus("SUPERSEDED")).toBe("DRAFT");
    expect(normalizeProspectusWorkflowStatus("APPROVED")).toBe("APPROVED");
    expect(normalizeProspectusWorkflowStatus("PUBLISHED")).toBe("PUBLISHED");
  });

  it("treats funding close and servicing as still prospectus-published", () => {
    expect(
      isNoteProspectusPublished({ status: "PUBLISHED", publishedAt })
    ).toBe(true);
    expect(isNoteProspectusPublished({ status: "FUNDING", publishedAt })).toBe(true);
    expect(isNoteProspectusPublished({ status: "ACTIVE", publishedAt })).toBe(true);
    expect(isNoteProspectusPublished({ status: "REPAID", publishedAt })).toBe(true);
    expect(
      isNoteProspectusPublished({ status: "FAILED_FUNDING", publishedAt })
    ).toBe(true);
    expect(isNoteProspectusPublished({ status: "FUNDING", publishedAt: null })).toBe(
      false
    );
    expect(
      isNoteProspectusPublished({ status: "PUBLISHED", publishedAt: null })
    ).toBe(false);
    expect(isNoteProspectusPublished({ status: "DRAFT", publishedAt })).toBe(false);
    expect(isNoteProspectusPublished({ status: "DRAFT", publishedAt: null })).toBe(
      false
    );
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
    expect(getProspectusDisplayStatus({ reviewStatus: "PUBLISHED", notePublished: false })).toBe(
      "Draft"
    );
    expect(
      getProspectusDisplayStatus({
        reviewStatus: "PUBLISHED",
        notePublished: isNoteProspectusPublished({ status: "FUNDING", publishedAt }),
      })
    ).toBe("Published");
    expect(formatProspectusListBadge("Draft")).toBe("Prospectus Draft");
    expect(formatProspectusListBadge("Approved")).toBe("Prospectus Approved");
    expect(formatProspectusListBadge("Published")).toBe("Prospectus Published");
  });
});
