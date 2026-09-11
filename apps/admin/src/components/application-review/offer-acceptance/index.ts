export {
  collapseOfferAcceptanceDescriptors,
  deriveMergedSectionStatus,
  isOfferAcceptanceTabDescriptor,
  OFFER_ACCEPTANCE_MERGED_SECTION_IDS,
  OFFER_ACCEPTANCE_TAB_ID,
  OFFER_ACCEPTANCE_TAB_LABEL,
  resolveReviewTabStatus,
} from "./unified-tab-descriptor";
export { OFFER_ACCEPTANCE_TAB_KIND } from "../review-registry";
export {
  canManageReviewSection,
  resolveSectionActionLock,
  REVIEW_SECTION_PERMISSION_MAP,
  type SectionActionLock,
  type SectionActionLockMap,
} from "./resolve-section-action-lock";
export {
  advanceOpenOfferAcceptanceStages,
  buildOfferAcceptanceStageModel,
  isReferenceOfferAcceptanceStage,
  resolveOfferAcceptanceFocusStageId,
  type OfferAcceptanceNextAction,
  type OfferAcceptanceOfferType,
  type OfferAcceptanceStage,
  type OfferAcceptanceStageId,
  type OfferAcceptanceStageInput,
  type OfferAcceptanceStageKind,
  type OfferAcceptanceStageModel,
  type OfferAcceptanceStageTone,
  type OfferAcceptanceStructureType,
} from "./offer-acceptance-stages";

export { InvoiceStackedFields } from "../sections/invoice-stacked-fields";
export { CustomerReviewFields } from "../sections/customer-review-fields";
export { ContractReviewFields } from "../sections/contract-review-fields";
export { ContractOfferConfirmDialog } from "../sections/contract-offer-confirm-dialog";
export {
  mergeOfferAcceptanceComments,
  offerAcceptanceCommentSourceLabel,
  resolveOfferAcceptanceCommentSection,
} from "./merge-offer-acceptance-comments";
export { OfferAcceptanceSection } from "./offer-acceptance-section";
