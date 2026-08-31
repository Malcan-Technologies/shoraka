/**
 * SECTION: Officer Deed of Assignment in Prospectus review
 * WHY: Mandatory for Approve; optional while Draft; not inferred from system data
 */

import { PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES } from "@cashsouk/types";
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
  it("review Zod schema invoicePaymaster only contains deedOfAssignment", () => {
    const schema = saveProspectusReviewDraftSchema.shape.draftContent.shape.page2.shape
      .invoicePaymaster;
    const keys = Object.keys(schema.unwrap().shape);
    expect(keys).toEqual(["deedOfAssignment"]);
    expect(keys).not.toContain("paymasterRating");
    expect(keys).not.toContain("confidenceGrading");
  });

  it("accepts all allowed DOA values and empty in draft schema", () => {
    for (const deedOfAssignment of PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES) {
      const draft = buildCompleteProspectusReviewDraft();
      draft.page2.invoicePaymaster = { deedOfAssignment };
      expect(validateDraftContent(draft)).toEqual([]);
      expect(
        saveProspectusReviewDraftSchema.shape.draftContent.parse(draft).page2.invoicePaymaster
      ).toEqual({ deedOfAssignment });
    }

    const empty = emptyProspectusReviewContent();
    empty.page2.invoicePaymaster = { deedOfAssignment: null };
    expect(validateDraftContent(empty)).toEqual([]);
  });

  it("rejects obsolete paymasterRating and confidenceGrading on save payloads", () => {
    const draft = buildCompleteProspectusReviewDraft();
    const result = saveProspectusReviewDraftSchema.shape.draftContent.safeParse({
      ...draft,
      page2: {
        ...draft.page2,
        invoicePaymaster: {
          deedOfAssignment: "Yes",
          paymasterRating: "PM1",
          confidenceGrading: "High",
        },
      },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
    expect(JSON.stringify(result.error.issues)).toContain("paymasterRating");
    expect(JSON.stringify(result.error.issues)).toContain("confidenceGrading");
  });

  it("does not emit paymasterRating or confidenceGrading on empty review JSON or publication", () => {
    const empty = emptyProspectusReviewContent();
    expect(empty.page2.invoicePaymaster).toEqual({ deedOfAssignment: null });
    expect(empty.page2.invoicePaymaster).not.toHaveProperty("paymasterRating");
    expect(empty.page2.invoicePaymaster).not.toHaveProperty("confidenceGrading");

    const publication = toProspectusPublicationContent(buildCompleteProspectusReviewDraft());
    expect(publication.invoicePaymaster).toEqual({ deedOfAssignment: "Yes" });
    expect(publication.invoicePaymaster).not.toHaveProperty("paymasterRating");
    expect(publication.invoicePaymaster).not.toHaveProperty("confidenceGrading");
  });

  it("allows draft save without officer fields but blocks approval only for missing DOA", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.invoicePaymaster = { deedOfAssignment: null };
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
      approvalErrors.some((e) => e.path === "page2.invoicePaymaster.paymasterRating")
    ).toBe(false);
    expect(
      approvalErrors.some((e) => e.path === "page2.invoicePaymaster.confidenceGrading")
    ).toBe(false);
  });

  it("approves when Deed of Assignment is selected", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.invoicePaymaster = { deedOfAssignment: "Yes" };
    expect(validateApprovalContent(draft)).toEqual([]);
  });

  it("resolves DOA into publication content and builder", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.invoicePaymaster = { deedOfAssignment: "No" };
    const publication = toProspectusPublicationContent(draft);
    expect(publication.invoicePaymaster).toEqual({ deedOfAssignment: "No" });

    const section = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 100 } },
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterSnapshot: { name: "KKR", entity_type: "Government" },
      officerDeedOfAssignment: publication.invoicePaymaster?.deedOfAssignment,
    });
    expect(section.deedOfAssignment).toBe("No");
    expect(section).not.toHaveProperty("paymasterRating");
    expect(section).not.toHaveProperty("confidenceGrading");
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
    });
    expect(section.deedOfAssignment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("changing officer Invoice & Paymaster fields changes draft fingerprint", () => {
    const approved = buildCompleteProspectusReviewDraft();
    const next = cloneReviewContent(approved);
    next.page2.invoicePaymaster = { deedOfAssignment: "No" };
    expect(hashDraftContent(approved)).not.toBe(hashDraftContent(next));
    expect(hashDraftContent(approved)).toBe(hashDraftContent(cloneReviewContent(approved)));
  });

  it("Page 3 metadata omits Paymaster/Confidence gradings while keeping Sector, Risk Rating, and Paymaster", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.invoicePaymaster = { deedOfAssignment: "Yes" };
    const publication = toProspectusPublicationContent(draft);
    const page3 = buildProspectusPageThree({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_INPUT,
      publicationContent: publication,
    });
    expect(page3.metadata.metadata).not.toHaveProperty("paymasterGrading");
    expect(page3.metadata.metadata).not.toHaveProperty("confidenceGrading");
    expect(page3.metadata.metadata.paymaster).toBeTruthy();
    expect(page3.metadata.metadata.riskRating).toBeTruthy();
    expect(page3.metadata.metadata.sector).toBeTruthy();
    expect(page3.metadata.metadata).not.toHaveProperty("issuer");
  });
});
