/**
 * SECTION: Officer Company Size in Prospectus review content
 * WHY: Separate mandatory field for Approve; optional while Draft
 */

import { PROSPECTUS_COMPANY_SIZE_VALUES } from "@cashsouk/types";
import { buildProspectusIssuerProfile } from "../prospectus/prospectus-issuer-profile";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "../prospectus/prospectus-issuer-profile.types";
import { hashDraftContent } from "./prospectus-approved-snapshot";
import {
  cloneReviewContent,
  emptyProspectusReviewContent,
  toProspectusPublicationContent,
} from "./prospectus-review-content";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import {
  saveProspectusReviewDraftSchema,
  validateApprovalContent,
  validateDraftContent,
} from "./prospectus-review.schemas";

describe("prospectus officer Company Size", () => {
  it("accepts all four dropdown values and empty in draft schema", () => {
    for (const size of PROSPECTUS_COMPANY_SIZE_VALUES) {
      const draft = buildCompleteProspectusReviewDraft();
      draft.page2.issuerProfile = { companySize: size };
      expect(validateDraftContent(draft)).toEqual([]);
      expect(
        saveProspectusReviewDraftSchema.shape.draftContent.parse(draft).page2.issuerProfile
          ?.companySize
      ).toBe(size);
    }

    const empty = emptyProspectusReviewContent();
    empty.page2.issuerProfile = { companySize: null };
    expect(validateDraftContent(empty)).toEqual([]);
  });

  it("allows draft save without Company Size but blocks approval", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.issuerProfile = { companySize: null };
    expect(validateDraftContent(draft)).toEqual([]);
    const approvalErrors = validateApprovalContent(draft);
    expect(
      approvalErrors.some(
        (e) =>
          e.path === "page2.issuerProfile.companySize" &&
          e.message === "Company Size is required before approving the Prospectus."
      )
    ).toBe(true);
  });

  it("approves when Company Size is selected", () => {
    const draft = buildCompleteProspectusReviewDraft();
    expect(draft.page2.issuerProfile?.companySize).toBe("Medium");
    expect(validateApprovalContent(draft)).toEqual([]);
  });

  it("keeps old reviews without issuerProfile compatible for draft and DNA render", () => {
    const draft = buildCompleteProspectusReviewDraft();
    delete draft.page2.issuerProfile;
    expect(validateDraftContent(draft)).toEqual([]);
    expect(validateApprovalContent(draft).some((e) => e.path.includes("companySize"))).toBe(
      true
    );
    const publication = toProspectusPublicationContent(draft);
    expect(publication.issuerProfile?.companySize ?? null).toBeNull();

    const profile = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Construction" },
      officerCompanySize: publication.issuerProfile?.companySize,
    });
    expect(profile.industry).toBe("Construction");
    expect(profile.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(profile).not.toHaveProperty("industryAndCompanySize");
  });

  it("resolves Company Size into publication content as a separate field", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.issuerProfile = { companySize: "Large" };
    const publication = toProspectusPublicationContent(draft);
    expect(publication.issuerProfile?.companySize).toBe("Large");

    const profile = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Trading" },
      officerCompanySize: publication.issuerProfile?.companySize,
    });
    expect(profile.industry).toBe("Trading");
    expect(profile.companySize).toBe("Large");
  });

  it("changing Company Size changes draft fingerprint (approval invalidation input)", () => {
    const approved = buildCompleteProspectusReviewDraft();
    approved.page2.issuerProfile = { companySize: "Micro" };
    const next = cloneReviewContent(approved);
    next.page2.issuerProfile = { companySize: "Small" };
    expect(hashDraftContent(approved)).not.toBe(hashDraftContent(next));
    expect(hashDraftContent(approved)).toBe(hashDraftContent(cloneReviewContent(approved)));
  });

  it("rejects invalid Company Size enum values", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.issuerProfile = { companySize: "SME" as "Micro" };
    expect(() => saveProspectusReviewDraftSchema.shape.draftContent.parse(draft)).toThrow();
  });
});
