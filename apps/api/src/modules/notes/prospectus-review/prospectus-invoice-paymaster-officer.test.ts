/**
 * SECTION: Officer DOA / Paymaster Rating / Confidence Grading in Prospectus review
 * WHY: Mandatory for Approve; optional while Draft; not inferred from system data
 */

import {
  PROSPECTUS_CONFIDENCE_GRADING_VALUES,
  PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES,
  PROSPECTUS_PAYMASTER_RATING_VALUES,
} from "@cashsouk/types";
import { buildProspectusInvoicePaymaster } from "../prospectus/prospectus-invoice-paymaster";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "../prospectus/prospectus-invoice-paymaster.types";
import { buildProspectusPageThree } from "../prospectus/prospectus-page-three-mapper";
import { SAMPLE_PROSPECTUS_PAGE_THREE_INPUT } from "../prospectus/prospectus-page-three.sample-data";
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

describe("prospectus officer Invoice & Paymaster fields", () => {
  it("accepts all allowed dropdown values and empty in draft schema", () => {
    for (const deedOfAssignment of PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES) {
      for (const paymasterRating of PROSPECTUS_PAYMASTER_RATING_VALUES) {
        for (const confidenceGrading of PROSPECTUS_CONFIDENCE_GRADING_VALUES) {
          const draft = buildCompleteProspectusReviewDraft();
          draft.page2.invoicePaymaster = {
            deedOfAssignment,
            paymasterRating,
            confidenceGrading,
          };
          expect(validateDraftContent(draft)).toEqual([]);
          expect(
            saveProspectusReviewDraftSchema.shape.draftContent.parse(draft).page2
              .invoicePaymaster
          ).toEqual({ deedOfAssignment, paymasterRating, confidenceGrading });
        }
      }
    }

    const empty = emptyProspectusReviewContent();
    empty.page2.invoicePaymaster = {
      deedOfAssignment: null,
      paymasterRating: null,
      confidenceGrading: null,
    };
    expect(validateDraftContent(empty)).toEqual([]);
  });

  it("allows draft save without officer fields but blocks approval", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.invoicePaymaster = {
      deedOfAssignment: null,
      paymasterRating: null,
      confidenceGrading: null,
    };
    expect(validateDraftContent(draft)).toEqual([]);
    const approvalErrors = validateApprovalContent(draft);
    expect(
      approvalErrors.some(
        (e) =>
          e.path === "page2.invoicePaymaster.deedOfAssignment" &&
          e.message ===
            "Deed of Assignment (DOA) is required before approving the Prospectus."
      )
    ).toBe(true);
    expect(
      approvalErrors.some(
        (e) =>
          e.path === "page2.invoicePaymaster.paymasterRating" &&
          e.message === "Paymaster Grading is required for Page 3 before approving the Prospectus."
      )
    ).toBe(true);
    expect(
      approvalErrors.some(
        (e) =>
          e.path === "page2.invoicePaymaster.confidenceGrading" &&
          e.message === "Confidence Grading is required for Page 3 before approving the Prospectus."
      )
    ).toBe(true);
  });

  it("approves when all three officer fields are selected", () => {
    const draft = buildCompleteProspectusReviewDraft();
    expect(draft.page2.invoicePaymaster).toEqual({
      deedOfAssignment: "Yes",
      paymasterRating: "PM1",
      confidenceGrading: "High",
    });
    expect(validateApprovalContent(draft)).toEqual([]);
  });

  it("resolves officer fields into publication content and builder", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.invoicePaymaster = {
      deedOfAssignment: "No",
      paymasterRating: "PM3",
      confidenceGrading: "Low",
    };
    const publication = toProspectusPublicationContent(draft);
    expect(publication.invoicePaymaster).toEqual({
      deedOfAssignment: "No",
      paymasterRating: "PM3",
      confidenceGrading: "Low",
    });

    const section = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 100 } },
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterSnapshot: { name: "KKR", entity_type: "Government" },
      officerDeedOfAssignment: publication.invoicePaymaster?.deedOfAssignment,
      officerPaymasterRating: publication.invoicePaymaster?.paymasterRating,
      officerConfidenceGrading: publication.invoicePaymaster?.confidenceGrading,
    });
    expect(section.deedOfAssignment).toBe("No");
    expect(section.paymasterRating).toBe("PM3");
    expect(section.confidenceGrading).toBe("Low");
  });

  it("keeps old reviews without invoicePaymaster compatible for draft and DNA render", () => {
    const draft = buildCompleteProspectusReviewDraft();
    delete draft.page2.invoicePaymaster;
    expect(validateDraftContent(draft)).toEqual([]);
    expect(
      validateApprovalContent(draft).some((e) => e.path.includes("invoicePaymaster"))
    ).toBe(true);
    const publication = toProspectusPublicationContent(draft);
    expect(publication.invoicePaymaster?.deedOfAssignment ?? null).toBeNull();
    const section = buildProspectusInvoicePaymaster({
      officerDeedOfAssignment: publication.invoicePaymaster?.deedOfAssignment,
      officerPaymasterRating: publication.invoicePaymaster?.paymasterRating,
      officerConfidenceGrading: publication.invoicePaymaster?.confidenceGrading,
    });
    expect(section.deedOfAssignment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(section.paymasterRating).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(section.confidenceGrading).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("changing officer Invoice & Paymaster fields changes draft fingerprint", () => {
    const approved = buildCompleteProspectusReviewDraft();
    const next = cloneReviewContent(approved);
    next.page2.invoicePaymaster = {
      deedOfAssignment: "No",
      paymasterRating: "PM4",
      confidenceGrading: "Low",
    };
    expect(hashDraftContent(approved)).not.toBe(hashDraftContent(next));
    expect(hashDraftContent(approved)).toBe(hashDraftContent(cloneReviewContent(approved)));
  });

  it("Page 3 metadata Paymaster/Confidence gradings match Page 2 officer catalogue values", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.invoicePaymaster = {
      deedOfAssignment: "Yes",
      paymasterRating: "PM3",
      confidenceGrading: "Low",
    };
    const publication = toProspectusPublicationContent(draft);
    const page2 = buildProspectusInvoicePaymaster({
      invoiceSnapshot: SAMPLE_PROSPECTUS_PAGE_THREE_INPUT.invoiceSnapshot,
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterSnapshot: SAMPLE_PROSPECTUS_PAGE_THREE_INPUT.paymasterSnapshot,
      officerPaymasterRating: publication.invoicePaymaster?.paymasterRating,
      officerConfidenceGrading: publication.invoicePaymaster?.confidenceGrading,
    });
    const page3 = buildProspectusPageThree({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_INPUT,
      publicationContent: publication,
    });
    expect(page3.metadata.metadata.paymasterGrading).toBe(page2.paymasterRating);
    expect(page3.metadata.metadata.confidenceGrading).toBe(page2.confidenceGrading);
    expect(page3.metadata.metadata.paymasterGrading).toBe("PM3");
    expect(page3.metadata.metadata.confidenceGrading).toBe("Low");
    expect(page3.metadata.metadata).not.toHaveProperty("issuer");
  });
});
