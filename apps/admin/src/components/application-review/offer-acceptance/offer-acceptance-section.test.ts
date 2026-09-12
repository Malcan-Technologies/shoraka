import * as fs from "fs";
import * as path from "path";

const STAGE_CARD = fs.readFileSync(path.join(__dirname, "stage-card.tsx"), "utf8");
const SECTION = fs.readFileSync(path.join(__dirname, "offer-acceptance-section.tsx"), "utf8");
const ISSUER_RESPONSE = fs.readFileSync(
  path.join(__dirname, "stage-issuer-response.tsx"),
  "utf8"
);
const SECTION_CONTENT = fs.readFileSync(path.join(__dirname, "../section-content.tsx"), "utf8");
const CONTRACT = fs.readFileSync(path.join(__dirname, "../sections/contract-section.tsx"), "utf8");
const INVOICE = fs.readFileSync(path.join(__dirname, "../sections/invoice-section.tsx"), "utf8");
const INVOICE_LIST = fs.readFileSync(
  path.join(__dirname, "../../invoice-review-list.tsx"),
  "utf8"
);
const ACCEPTANCE = fs.readFileSync(
  path.join(__dirname, "../sections/acceptance-section.tsx"),
  "utf8"
);
const REVIEW_CARD = fs.readFileSync(path.join(__dirname, "../review-section-card.tsx"), "utf8");
const COMMENTS = fs.readFileSync(path.join(__dirname, "../section-comments.tsx"), "utf8");
const FACILITY_SUMMARY = fs.readFileSync(
  path.join(__dirname, "../contract-facility-summary.tsx"),
  "utf8"
);

describe("offer-acceptance stage card", () => {
  it("uses StatusBadge, Expand/Collapse, and numbered done/current/pending/locked markers", () => {
    expect(STAGE_CARD).toContain("StatusBadge");
    expect(STAGE_CARD).toContain("Collapse");
    expect(STAGE_CARD).toContain("Expand");
    expect(STAGE_CARD).toContain('marker === "done"');
    expect(STAGE_CARD).toContain('marker === "current"');
    expect(STAGE_CARD).toContain('return "pending"');
    expect(STAGE_CARD).toContain("if (isCurrent) return \"current\"");
    expect(STAGE_CARD).toContain("border-primary");
    expect(STAGE_CARD).toContain("CheckIcon");
    expect(STAGE_CARD).toContain("CollapsibleTrigger");
    expect(STAGE_CARD).toContain('aria-current={isCurrent ? "step" : undefined}');
  });

  it("renders reference stages without rail numbers or connectors", () => {
    expect(STAGE_CARD).toContain("isReferenceOfferAcceptanceStage");
    expect(STAGE_CARD).toContain("workflowNumber");
    expect(STAGE_CARD).toContain("isLastWorkflow");
    expect(STAGE_CARD).toContain("if (isReference)");
  });
});

describe("offer-acceptance wiring", () => {
  it("adds the unified tab case and reuses existing section handlers", () => {
    expect(SECTION_CONTENT).toContain('case "offer_acceptance"');
    expect(SECTION_CONTENT).toContain("OfferAcceptanceSection");
    expect(SECTION_CONTENT).toContain("sectionActionLocks={sectionActionLocks}");
    expect(SECTION_CONTENT).toContain("offerAcceptanceFocusStageId={offerAcceptanceFocusStageId}");
    expect(SECTION_CONTENT).toContain(
      "isInvoiceOnlyFinancingStructure({ structure_type: structureType })"
    );
    expect(SECTION_CONTENT).toContain('case "contract_details"');
    expect(SECTION_CONTENT).toContain('case "invoice_details"');
    expect(SECTION_CONTENT).toContain('case "acceptance_documents"');
  });

  it("expands the focused stage and next-action CTA without new mutations", () => {
    expect(SECTION).toContain("expandStage");
    expect(SECTION).toContain("advanceOpenOfferAcceptanceStages");
    expect(SECTION).toContain("appliedFocusStageIdRef");
    expect(SECTION).toContain("if (prev.has(stageId)) return prev");
    expect(SECTION).toContain("offerAcceptanceFocusStageId");
    expect(SECTION).toContain("nextAction.primaryLabel");
    expect(SECTION).toContain("buildOfferAcceptanceStageModel");
    expect(SECTION).toContain("sourceApplicationDisplayReference: sourceRef,\n    canManageSigning,");
    expect(SECTION).toContain("workflowHasAcceptanceDocuments");
    expect(SECTION).toContain("workflowHasSigningPackage");
    expect(SECTION).not.toContain("acceptanceLock.canManage");
    expect(SECTION).toContain('variant="kpi-strip"');
    expect(SECTION).toContain("MergedSectionComments");
    expect(SECTION).toContain("StageFacilityReview");
    expect(SECTION).toContain("StageFacilitySendOffer");
    expect(SECTION).toContain("StageInvoiceReview");
    expect(SECTION).toContain("StageInvoiceSendOffer");
    expect(SECTION).toContain("StageIssuerResponse");
    expect(SECTION).toContain("StageFacilityFee");
    expect(SECTION).toContain("StageAcceptanceDocuments");
    expect(SECTION).toContain("StageSigningPackage");
    expect(SECTION).toContain("StageInheritedAcceptance");
    expect(SECTION).toContain("StageCustomerReview");
    expect(SECTION).toContain(
      'selectedInvoiceId: stageModel.offerType === "invoice" ? selectedThisAppInvoiceId : null'
    );
    expect(ACCEPTANCE).toContain("selectedInvoiceId={selectedInvoiceId}");
    expect(ACCEPTANCE).toContain("isInvoiceOnly ? selectedInvoiceId : null");
    expect(SECTION).toContain('structureType === "new_contract" && appInvoices.length > 0');
  });

  it("keeps send-offer, signing, and document mutations on the original sections", () => {
    expect(CONTRACT).toContain('contentMode === "offer"');
    expect(CONTRACT).toContain("onSendOffer");
    expect(CONTRACT).toContain("buildSendContractOfferPayload");
    expect(INVOICE).toContain('contentMode === "review"');
    expect(INVOICE).toContain("InvoiceOfferPanel");
    expect(INVOICE).toContain("onSendInvoiceOffer");
    expect(INVOICE).toContain("viewSignedOfferOnly");
    expect(INVOICE).toContain('entityStatus === "APPROVED"');
    expect(INVOICE).not.toContain("showApprove={false}");
    expect(INVOICE).toContain("!isAdminRejected &&");
    expect(INVOICE).toContain("showRequestAmendment={!isAdminRejected}");
    expect(INVOICE).toContain('entityStatus === "REJECTED"');
    expect(INVOICE_LIST).toContain("!isAdminRejected &&");
    expect(INVOICE_LIST).toContain("showRequestAmendment={!isAdminRejected}");
    expect(ACCEPTANCE).toContain('contentMode === "documents"');
    expect(ACCEPTANCE).toContain("SigningEnvelopePanel");
    expect(ACCEPTANCE).toContain("AuthorizedPartiesReadOnly");
  });

  it("keeps per-section locks on isActionLocked instead of hiding actions", () => {
    expect(SECTION).toContain("isActionLocked: !!contractLock?.locked");
    expect(SECTION).toContain("isActionLocked: invoiceActionLocked");
    expect(SECTION).toContain("Approve Customer details first.");
    expect(SECTION).toContain("isActionLocked: !!acceptanceLock?.locked || isInheritedAcceptance");
    expect(SECTION).not.toContain("isReviewable && !contractLock");
    expect(SECTION).not.toContain("isReviewable && !invoiceLock");
  });

  it("shows other-app invoices as read-only details without current-app offer stages or a borrowed source link", () => {
    expect(SECTION).toContain("selectedIsOther");
    expect(SECTION).toContain("InvoiceStackedFields");
    expect(SECTION).toContain("otherInvoiceApplicationHref");
    expect(SECTION).toContain("selectedOtherInvoice?.product_id");
    expect(SECTION).toContain("OTHER_FACILITY_INVOICE_HELPER");
    expect(SECTION).toContain("const nextAction = selectedIsOther ? null : stageModel.nextAction");
    expect(SECTION).toContain("selectedIsOther ? (");
    expect(SECTION).toContain("selectedOtherInvoice ? (");
    expect(SECTION).not.toContain("inheritedSourceApplication?.productId && inheritedSourceApplication.id");
    expect(SECTION).toContain("resolveThisAppInvoiceIdForStages");
  });

  it("leaves facility actions on ContractSection and removes the issuer-response dropdown", () => {
    expect(ISSUER_RESPONSE).not.toContain("SectionActionDropdown");
    expect(ISSUER_RESPONSE).toContain("isAcceptanceHubReviewItem");
    expect(ISSUER_RESPONSE).toContain("issuerResponseBannerKind");
    expect(ISSUER_RESPONSE).not.toContain("status === \"REJECTED\"");
    expect(CONTRACT).toContain("isContractFinalizedByIssuer");
    expect(CONTRACT).toContain("showApprove={!isContractOfferSendLocked && !isContractFinalizedByIssuer}");
    expect(CONTRACT).toContain("onResetToPending={onResetSectionToPending}");
    expect(CONTRACT).toContain("onViewSignedOffer={onViewSignedContractOffer}");
  });

  it("keeps default ReviewSectionCard, comments, and facility summary rendering outside these tabs", () => {
    expect(REVIEW_CARD).toContain("embedded = false");
    expect(REVIEW_CARD).toContain("<Card className=\"rounded-2xl\">");
    expect(COMMENTS).toContain("{entry.sourceLabel ? (");
    expect(FACILITY_SUMMARY).toContain('variant = "meters"');
    expect(FACILITY_SUMMARY).toContain('if (variant === "kpi-strip")');
  });
});
