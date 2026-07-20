/**
 * SECTION: Officer Company Size in Prospectus review content
 * WHY: Optional select persists in draft JSON; publish freezes via publication content
 */

import { PROSPECTUS_COMPANY_SIZE_VALUES } from "@cashsouk/types";
import { buildProspectusIssuerProfile } from "../prospectus/prospectus-issuer-profile";
import { hashDraftContent } from "./prospectus-approved-snapshot";
import {
  cloneReviewContent,
  emptyProspectusReviewContent,
  toProspectusPublicationContent,
} from "./prospectus-review-content";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import {
  saveProspectusReviewDraftSchema,
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

    const empty = buildCompleteProspectusReviewDraft();
    empty.page2.issuerProfile = { companySize: null };
    expect(validateDraftContent(empty)).toEqual([]);
    expect(
      saveProspectusReviewDraftSchema.shape.draftContent.parse(empty).page2.issuerProfile
        ?.companySize
    ).toBeNull();
  });

  it("keeps old reviews without issuerProfile compatible", () => {
    const draft = buildCompleteProspectusReviewDraft();
    delete draft.page2.issuerProfile;
    expect(validateDraftContent(draft)).toEqual([]);
    const publication = toProspectusPublicationContent(draft);
    expect(publication.issuerProfile?.companySize ?? null).toBeNull();

    const profile = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Construction" },
      officerCompanySize: publication.issuerProfile?.companySize,
    });
    expect(profile.industryAndCompanySize).toBe("Construction");
  });

  it("resolves Company Size into publication content for preview/approve", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.issuerProfile = { companySize: "Large" };
    const publication = toProspectusPublicationContent(draft);
    expect(publication.issuerProfile?.companySize).toBe("Large");

    const profile = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Trading" },
      officerCompanySize: publication.issuerProfile?.companySize,
    });
    expect(profile.industryAndCompanySize).toBe("Trading | Large");
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
