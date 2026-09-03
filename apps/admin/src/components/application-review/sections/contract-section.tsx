"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@cashsouk/ui";
import { formatMoney, parseMoney } from "@cashsouk/ui";
import {
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePatchContractCustomerLargePrivate } from "@/hooks/use-application-review-actions";
import { format } from "date-fns";
import { formatCurrency, resolveRequestedFacility, resolveOfferedFacility, resolveApprovedFacility } from "@cashsouk/config";
import {
  FACILITY_FEE_RATE_MAX_PERCENT,
  getOfferPhaseDeadlineDisplay,
  paymasterIdentityOfferBlockReason,
  previewAcceptanceDeadlineFromWorkflow,
  REQUESTED_FACILITY_BELOW_CONTRACT_COPY,
} from "@cashsouk/types";
import {
  buildSendContractOfferPayload,
  FACILITY_FEE_RATE_FIELD_TOOLTIP,
  FACILITY_FEE_UPFRONT_FIELD_TOOLTIP,
  parseFacilityFeeRatePercentInput,
  parseFacilityFeeUpfrontInput,
  resolveFacilityFeeOfferSplit,
  resolveUpfrontCollectAmountForSubmit,
  seedFacilityFeeUpfrontInput,
  validateFacilityFeeUpfrontCollectAmount,
} from "@/lib/facility-fee-offer-preview";
import { ReviewFieldLabel } from "../review-field-label";
import {
  OFFERED_FACILITY_BELOW_CONTRACT_COPY,
  REMAINING_ALLOCATION_LABEL,
  REMAINING_CREDIT_LABEL,
  RESERVED_LABEL,
  resolveFacilityOfferBlockReason,
} from "@/lib/facility-capacity-display";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { OfferAcceptanceDeadlineConfirmRows } from "../offer-acceptance-deadline-confirm-rows";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewValueClassTextArea,
  reviewRowGridClass,
  reviewEmptyStateClass,
  REVIEW_EMPTY_LABEL,
  formatReviewValue,
  formatReviewDate,
  formatFileSize,
} from "../review-section-styles";
import { parseFacilityAmount } from "@/contracts/utils/contract-facility-metrics";
import type { ReviewSectionId } from "../section-types";
import { ComparisonFieldRow, ComparisonYesNoRadioRow, unknownToTriBool } from "../comparison-field-row";
import { PaymasterVerificationPanel, type ApplicationReviewPaymaster } from "@/paymasters/components/paymaster-verification-panel";
import {
  shouldShowSubmittedVerifiedPaymaster,
  SubmittedVerifiedPaymasterIdentity,
} from "../paymaster-identity-comparison";
import { usePermissions } from "@/hooks/use-permissions";
import {
  ComparisonDocumentTitleRow,
  fileDocToComparisonChips,
} from "../comparison-document-pair";

interface FileDoc {
  s3_key?: string;
  file_name?: string;
  file_size?: number;
}

/** Same width for Offered Facility (money) and large-private select in Contract review. */
const contractReviewControlWidthClass = "w-full min-w-0 max-w-[280px]";

export interface ContractSectionProps {
  /** Used to PATCH `customer_details.is_large_private_company` (empty when comparison-only UI). */
  applicationId?: string;
  contractDetails: unknown;
  offerDetails?: unknown;
  /** Contract row status (e.g. OFFER_SENT, WITHDRAWN); used to lock Send Offer after send or issuer withdrawal. */
  contractStatus?: string;
  customerDetails?: unknown;
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  onResetSectionToPending?: (section: ReviewSectionId) => void;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
  onSendOffer?: (payload: {
    offeredFacility: number;
    facilityFeeRatePercent: number | null;
    facilityFeeUpfrontCollectAmount: number;
  }) => Promise<void>;
  /**
   * Product-level default Facility Fee rate (%).
   * Used only as a prefill when `offer_details.facility_fee_rate_percent` is missing.
   */
  productDefaultFacilityFeeRatePercent?: number | null;
  /** Frozen product workflow — used for Send Offer acceptance-deadline preview. */
  productWorkflow?: unknown;
  isSendOfferPending?: boolean;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  onViewSignedContractOffer?: () => void | Promise<void>;
  signedContractOfferLetterAvailable?: boolean;
  viewSignedOfferLetterPending?: boolean;
  sectionComparison?: {
    before: {
      contractDetails: unknown;
      customerDetails: unknown;
      offerDetails: unknown;
    };
    after: {
      contractDetails: unknown;
      customerDetails: unknown;
      offerDetails: unknown;
    };
    isPathChanged: (path: string) => boolean;
  };
  hideSectionComments?: boolean;
  /** Canonical occupancy from section-content — keeps remaining/reserved aligned with invoice and acceptance. */
  reviewOccupancy?: {
    remainingCredit: number;
    remainingAllocation: number;
    reservedFacility: number;
  };
  paymaster?: ApplicationReviewPaymaster | null;
  paymasterId?: string | null;
}

export function ContractSection({
  applicationId = "",
  contractDetails,
  offerDetails,
  contractStatus: contractRowStatus,
  customerDetails,
  section,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  sectionStatus,
  onResetSectionToPending,
  onApprove,
  onReject,
  onRequestAmendment,
  onSendOffer,
  productDefaultFacilityFeeRatePercent,
  productWorkflow,
  isSendOfferPending,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
  comments,
  onAddComment,
  onViewSignedContractOffer,
  signedContractOfferLetterAvailable,
  sectionComparison,
  hideSectionComments = false,
  reviewOccupancy,
  paymaster,
  paymasterId,
}: ContractSectionProps) {
  const { can } = usePermissions();
  const canManagePaymasters = can("paymasters.manage");
  const patchLargePrivate = usePatchContractCustomerLargePrivate();
  const liveCustomerDetails = customerDetails as Record<string, unknown> | null | undefined;
  const [largePrivateCompany, setLargePrivateCompany] = React.useState<boolean | null>(() =>
    unknownToTriBool(liveCustomerDetails?.is_large_private_company)
  );
  const [largePrivateHighlight, setLargePrivateHighlight] = React.useState(false);

  React.useEffect(() => {
    setLargePrivateCompany(unknownToTriBool(liveCustomerDetails?.is_large_private_company));
  }, [liveCustomerDetails?.is_large_private_company]);

  const cd = contractDetails as Record<string, unknown> | null | undefined;
  const offer = offerDetails as Record<string, unknown> | null | undefined;
  const cust = liveCustomerDetails;
  const showIdentityComparison = shouldShowSubmittedVerifiedPaymaster({
    customerDetails: cust,
    paymaster,
  });
  const paymasterOfferBlock = paymasterIdentityOfferBlockReason({
    submitted: cust,
    paymaster,
  });

  const contractDoc = cd?.document as FileDoc | undefined;
  const requestedFacility = resolveRequestedFacility(cd);
  const approvedShown = resolveApprovedFacility(contractRowStatus ?? "", cd);
  const utilizedShown = parseFacilityAmount(cd?.utilized_facility) ?? 0;
  const reservedShown =
    reviewOccupancy?.reservedFacility ?? parseFacilityAmount(cd?.pending_facility) ?? 0;
  const availableShown =
    reviewOccupancy?.remainingCredit ??
    parseFacilityAmount(cd?.available_facility) ??
    (approvedShown > 0 ? approvedShown - utilizedShown - reservedShown : 0);
  const contractValue =
    parseFacilityAmount(cd?.value) ?? parseFacilityAmount(cd?.contract_value) ?? 0;
  const remainingCredit =
    reviewOccupancy?.remainingCredit ?? parseFacilityAmount(cd?.available_facility);
  const remainingAllocation =
    reviewOccupancy?.remainingAllocation ?? parseFacilityAmount(cd?.lifetime_remaining);
  const persistedOffered = resolveOfferedFacility(offer);
  const offerSentAtRaw =
    typeof offer?.sent_at === "string" && offer.sent_at.trim().length > 0 ? offer.sent_at : null;
  let offerSentAtLabel: string | null = null;
  if (offerSentAtRaw) {
    const d = new Date(offerSentAtRaw);
    if (!Number.isNaN(d.getTime())) offerSentAtLabel = format(d, "PPpp");
  }
  const offerRespondedAtRaw =
    typeof offer?.responded_at === "string" && offer.responded_at.trim().length > 0
      ? offer.responded_at
      : null;
  let offerRespondedAtLabel: string | null = null;
  if (offerRespondedAtRaw) {
    const d = new Date(offerRespondedAtRaw);
    if (!Number.isNaN(d.getTime())) offerRespondedAtLabel = format(d, "PPpp");
  }
  const offerTimelineLine = (() => {
    if (offerRespondedAtLabel) {
      if (contractRowStatus === "APPROVED") {
        return `Issuer accepted the offer on ${offerRespondedAtLabel}`;
      }
      if (contractRowStatus === "WITHDRAWN") {
        return `Issuer declined the offer on ${offerRespondedAtLabel}`;
      }
    }
    if (offerSentAtLabel) {
      return `Offer sent ${offerSentAtLabel}`;
    }
    return null;
  })();
  const phaseDeadlineDisplay =
    contractRowStatus === "OFFER_SENT" || contractRowStatus === "OFFER_EXPIRED"
      ? getOfferPhaseDeadlineDisplay(offerDetails)
      : null;
  const isContractOfferSendLocked =
    contractRowStatus === "OFFER_SENT" ||
    contractRowStatus === "WITHDRAWN" ||
    contractRowStatus === "APPROVED" ||
    contractRowStatus === "REJECTED";
  const seedOfferedInput = persistedOffered > 0 ? formatMoney(persistedOffered) : "";
  const [offeredFacilityInput, setOfferedFacilityInput] = React.useState<string>(seedOfferedInput);
  const seedFacilityFeeRatePercent =
    typeof offer?.facility_fee_rate_percent === "number"
      ? offer.facility_fee_rate_percent
      : productDefaultFacilityFeeRatePercent ?? null;
  const seedFacilityFeeInput =
    seedFacilityFeeRatePercent != null ? String(seedFacilityFeeRatePercent) : "";
  const [facilityFeeRatePercentInput, setFacilityFeeRatePercentInput] = React.useState<string>(
    seedFacilityFeeInput
  );
  const seedFacilityFeeUpfront = seedFacilityFeeUpfrontInput(offer);
  const [facilityFeeUpfrontInput, setFacilityFeeUpfrontInput] = React.useState<string>(
    seedFacilityFeeUpfront
  );
  const [contractOfferConfirmOpen, setContractOfferConfirmOpen] = React.useState(false);
  const acceptanceDeadlinePreview = previewAcceptanceDeadlineFromWorkflow(productWorkflow);

  React.useEffect(() => {
    setOfferedFacilityInput(persistedOffered > 0 ? formatMoney(persistedOffered) : "");
  }, [persistedOffered]);
  React.useEffect(() => {
    setFacilityFeeRatePercentInput(seedFacilityFeeInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.facility_fee_rate_percent, productDefaultFacilityFeeRatePercent]);
  React.useEffect(() => {
    setFacilityFeeUpfrontInput(seedFacilityFeeUpfrontInput(offer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.facility_fee_upfront_collect_amount]);

  const hasData = cd || cust;
  const offeredFacility = parseMoney(offeredFacilityInput);
  const offeredFacilityInputTrimmed = offeredFacilityInput.trim();
  const offeredFacilityNotPositive =
    offeredFacilityInputTrimmed.length > 0 && offeredFacility <= 0;
  const facilityOfferBlockReason = resolveFacilityOfferBlockReason({
    requestedFacility,
    offeredFacility,
    contractValue,
  });
  const isContractApproved = sectionStatus === "APPROVED";
  const isContractFinalizedByIssuer = isContractApproved;
  const showViewSignedOfferOnlyAction =
    isContractFinalizedByIssuer &&
    !!signedContractOfferLetterAvailable &&
    !!onViewSignedContractOffer;
  const canSendContractOffer =
    !isContractApproved &&
    !isContractOfferSendLocked &&
    offeredFacility > 0 &&
    !facilityOfferBlockReason;
  const facilityFeeRatePercentParsed = React.useMemo(
    () => parseFacilityFeeRatePercentInput(facilityFeeRatePercentInput),
    [facilityFeeRatePercentInput]
  );
  const facilityFeeRatePercentError = (() => {
    if (facilityFeeRatePercentParsed == null) {
      return facilityFeeRatePercentInput.trim().length > 0
        ? "Facility fee rate must be a valid number"
        : null;
    }
    if (facilityFeeRatePercentParsed < 0 || facilityFeeRatePercentParsed > FACILITY_FEE_RATE_MAX_PERCENT) {
      return `Facility fee rate must be between 0% and ${FACILITY_FEE_RATE_MAX_PERCENT}%`;
    }
    const scaled = facilityFeeRatePercentParsed * 100;
    const rounded = Math.round(scaled);
    return Math.abs(scaled - rounded) > 1e-9
      ? "Facility fee rate can have up to 2 decimal places"
      : null;
  })();
  const facilityFeeUpfrontParsed = React.useMemo(
    () => parseFacilityFeeUpfrontInput(facilityFeeUpfrontInput),
    [facilityFeeUpfrontInput]
  );
  const facilityFeeSplit = resolveFacilityFeeOfferSplit({
    offeredFacility,
    facilityFeeRatePercent: facilityFeeRatePercentParsed,
    upfrontCollectAmount: facilityFeeUpfrontParsed ?? 0,
  });
  const facilityFeeUpfrontError = validateFacilityFeeUpfrontCollectAmount({
    rawInput: facilityFeeUpfrontInput,
    upfrontCollectAmount: facilityFeeUpfrontParsed,
    totalFacilityFee: facilityFeeSplit.totalFacilityFee,
  });
  const facilityFeeInputsDisabled =
    !isReviewable ||
    !!isActionLocked ||
    !onSendOffer ||
    isContractApproved ||
    isContractOfferSendLocked;
  // Facility fee rate is optional; errors are only used to block "Send Offer" when a value is provided.

  const assertLargePrivateThenOpenOffer = () => {
    console.log("Customer Large Private:", largePrivateCompany);
    if (largePrivateCompany === null) {
      console.log("Blocked: Customer type not confirmed");
      toast.error("Please confirm if customer is a large private company");
      setLargePrivateHighlight(true);
      return;
    }
    if (paymasterOfferBlock) {
      toast.error(paymasterOfferBlock);
      return;
    }
    setContractOfferConfirmOpen(true);
  };

  const handleConfirmContractOffer = async () => {
    console.log("Customer Large Private:", largePrivateCompany);
    if (largePrivateCompany === null) {
      console.log("Blocked: Customer type not confirmed");
      toast.error("Please confirm if customer is a large private company");
      setLargePrivateHighlight(true);
      return;
    }
    if (paymasterOfferBlock) {
      toast.error(paymasterOfferBlock);
      return;
    }
    if (!onSendOffer || !canSendContractOffer) return;
    if (facilityFeeRatePercentError) {
      toast.error(facilityFeeRatePercentError);
      return;
    }
    if (facilityFeeUpfrontError) {
      toast.error(facilityFeeUpfrontError);
      return;
    }
    const upfrontCollectAmount = resolveUpfrontCollectAmountForSubmit(facilityFeeUpfrontInput);
    if (upfrontCollectAmount == null) {
      toast.error("Upfront amount must be a valid number");
      return;
    }
    const payload = buildSendContractOfferPayload({
      offeredFacility,
      facilityFeeRatePercent: facilityFeeRatePercentParsed,
      upfrontCollectAmount,
    });
    await onSendOffer(payload);
    setContractOfferConfirmOpen(false);
  };

  const persistLargePrivate = React.useCallback(
    async (value: boolean) => {
      if (!applicationId) {
        toast.error("Missing application id; cannot save customer type.");
        return;
      }
      console.log("Customer Large Private:", value);
      setLargePrivateCompany(value);
      setLargePrivateHighlight(false);
      try {
        await patchLargePrivate.mutateAsync({ applicationId, isLargePrivateCompany: value });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save customer type");
        setLargePrivateCompany(unknownToTriBool(liveCustomerDetails?.is_large_private_company));
      }
    },
    [applicationId, patchLargePrivate, liveCustomerDetails?.is_large_private_company]
  );

  if (sectionComparison) {
    const { before, after, isPathChanged } = sectionComparison;
    const bCd = before.contractDetails as Record<string, unknown> | null | undefined;
    const aCd = after.contractDetails as Record<string, unknown> | null | undefined;
    const bCust = before.customerDetails as Record<string, unknown> | null | undefined;
    const aCust = after.customerDetails as Record<string, unknown> | null | undefined;
    const bOffer = before.offerDetails as Record<string, unknown> | null | undefined;
    const aOffer = after.offerDetails as Record<string, unknown> | null | undefined;
    const rf = (cd: typeof bCd) => (cd ? resolveRequestedFacility(cd) : 0);
    const of = (o: typeof bOffer) => resolveOfferedFacility(o);
    return (
      <ReviewSectionCard title="Facility" icon={DocumentTextIcon} section={section} isReviewable={false}>
        <ReviewFieldBlock title="Offer to Issuer">
          <div className="space-y-2">
            <ComparisonFieldRow
              label="Requested Facility"
              before={rf(bCd) > 0 ? formatCurrency(rf(bCd)) : REVIEW_EMPTY_LABEL}
              after={rf(aCd) > 0 ? formatCurrency(rf(aCd)) : REVIEW_EMPTY_LABEL}
              changed={isPathChanged("contract")}
            />
            <ComparisonFieldRow
              label="Offered Facility"
              before={of(bOffer) > 0 ? formatCurrency(of(bOffer)) : REVIEW_EMPTY_LABEL}
              after={of(aOffer) > 0 ? formatCurrency(of(aOffer)) : REVIEW_EMPTY_LABEL}
              changed={isPathChanged("contract")}
            />
            <ComparisonFieldRow
              label="Facility fee rate"
              before={
                typeof bOffer?.facility_fee_rate_percent === "number"
                  ? `${bOffer.facility_fee_rate_percent}%`
                  : REVIEW_EMPTY_LABEL
              }
              after={
                typeof aOffer?.facility_fee_rate_percent === "number"
                  ? `${aOffer.facility_fee_rate_percent}%`
                  : REVIEW_EMPTY_LABEL
              }
              changed={isPathChanged("contract")}
            />
            <ComparisonFieldRow
              label="Collect upfront via payment gateway"
              before={
                typeof bOffer?.facility_fee_upfront_collect_amount === "number"
                  ? formatCurrency(bOffer.facility_fee_upfront_collect_amount)
                  : REVIEW_EMPTY_LABEL
              }
              after={
                typeof aOffer?.facility_fee_upfront_collect_amount === "number"
                  ? formatCurrency(aOffer.facility_fee_upfront_collect_amount)
                  : REVIEW_EMPTY_LABEL
              }
              changed={isPathChanged("contract")}
            />
          </div>
        </ReviewFieldBlock>
        {(bCd || aCd) && (
          <ReviewFieldBlock title="Contract Details">
            <div className="space-y-2">
              <ComparisonFieldRow
                label="Contract Title"
                before={formatReviewValue(bCd?.title)}
                after={formatReviewValue(aCd?.title)}
                changed={isPathChanged("contract")}
              />
              <ComparisonFieldRow
                label="Contract Description"
                before={formatReviewValue(bCd?.description)}
                after={formatReviewValue(aCd?.description)}
                changed={isPathChanged("contract")}
                multiline
              />
              <ComparisonFieldRow
                label="Contract Number"
                before={formatReviewValue(bCd?.number)}
                after={formatReviewValue(aCd?.number)}
                changed={isPathChanged("contract")}
              />
              <ComparisonFieldRow
                label="Contract Value"
                before={
                  typeof bCd?.value === "number" ? formatCurrency(bCd.value) : formatReviewValue(bCd?.value)
                }
                after={
                  typeof aCd?.value === "number" ? formatCurrency(aCd.value) : formatReviewValue(aCd?.value)
                }
                changed={isPathChanged("contract")}
              />
              <ComparisonFieldRow
                label="Contract Financing"
                before={
                  typeof bCd?.financing === "number"
                    ? formatCurrency(bCd.financing)
                    : formatReviewValue(bCd?.financing)
                }
                after={
                  typeof aCd?.financing === "number"
                    ? formatCurrency(aCd.financing)
                    : formatReviewValue(aCd?.financing)
                }
                changed={isPathChanged("contract")}
              />
              <ComparisonFieldRow
                label="Contract Start Date"
                before={formatReviewDate(bCd?.start_date as string)}
                after={formatReviewDate(aCd?.start_date as string)}
                changed={isPathChanged("contract")}
              />
              <ComparisonFieldRow
                label="Contract End Date"
                before={formatReviewDate(bCd?.end_date as string)}
                after={formatReviewDate(aCd?.end_date as string)}
                changed={isPathChanged("contract")}
              />
            </div>
          </ReviewFieldBlock>
        )}
        {(bCust || aCust) && (
          <ReviewFieldBlock title="Customer Details">
            <div className="space-y-2">
              <ComparisonFieldRow
                label="Customer Name"
                before={formatReviewValue(bCust?.name)}
                after={formatReviewValue(aCust?.name)}
                changed={isPathChanged("contract")}
              />
              <ComparisonFieldRow
                label="Customer Entity Type"
                before={formatReviewValue(bCust?.entity_type)}
                after={formatReviewValue(aCust?.entity_type)}
                changed={isPathChanged("contract")}
              />
              <ComparisonYesNoRadioRow
                label={
                  <>
                    Is Customer a Large Private Company?{" "}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </>
                }
                beforeValue={unknownToTriBool(bCust?.is_large_private_company)}
                afterValue={unknownToTriBool(aCust?.is_large_private_company)}
                changed={isPathChanged("contract")}
              />
              <ComparisonFieldRow
                label="Customer SSM Number"
                before={formatReviewValue(bCust?.ssm_number)}
                after={formatReviewValue(aCust?.ssm_number)}
                changed={isPathChanged("contract")}
              />
              <ComparisonFieldRow
                label="Customer Country"
                before={formatReviewValue(bCust?.country)}
                after={formatReviewValue(aCust?.country)}
                changed={isPathChanged("contract")}
              />
              <ComparisonYesNoRadioRow
                label="Is Customer Related to Issuer?"
                beforeValue={unknownToTriBool(bCust?.is_related_party)}
                afterValue={unknownToTriBool(aCust?.is_related_party)}
                changed={isPathChanged("contract")}
              />
            </div>
          </ReviewFieldBlock>
        )}
        <ReviewFieldBlock title="Evidence">
          <div className="space-y-6">
            <ComparisonDocumentTitleRow
              title="Contract Document"
              beforeFiles={fileDocToComparisonChips(bCd?.document as FileDoc | undefined)}
              afterFiles={fileDocToComparisonChips(aCd?.document as FileDoc | undefined)}
              markChanged={isPathChanged("contract")}
              onViewDocument={onViewDocument}
              onDownloadDocument={onDownloadDocument}
              viewDocumentPending={viewDocumentPending}
            />
          </div>
        </ReviewFieldBlock>
        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </ReviewSectionCard>
    );
  }

  return (
    <ReviewSectionCard
      title="Facility"
      icon={DocumentTextIcon}
      section={section}
      isReviewable={isReviewable}
      approvePending={approvePending}
      isActionLocked={isActionLocked || isContractFinalizedByIssuer}
      actionLockTooltip={
        isContractFinalizedByIssuer
          ? "Facility offer finalized by issuer. No further admin actions are allowed."
          : actionLockTooltip
      }
      sectionStatus={sectionStatus}
      onResetToPending={onResetSectionToPending}
      onApprove={onApprove}
      onReject={onReject}
      onRequestAmendment={onRequestAmendment}
      showApprove={false}
      viewSignedOfferOnly={showViewSignedOfferOnlyAction}
      onViewSignedOffer={onViewSignedContractOffer}
      signedOfferLetterAvailable={!!signedContractOfferLetterAvailable}
    >
      {hasData ? (
        <>
          <ReviewFieldBlock title="Offer to Issuer">
            <div className="space-y-4">
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Requested Facility</Label>
                <div className={reviewValueClass}>
                  {requestedFacility > 0 ? formatCurrency(requestedFacility) : REVIEW_EMPTY_LABEL}
                </div>
                <Label className={reviewLabelClass}>Offered Facility</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                    <MoneyInput
                      value={offeredFacilityInput}
                      onValueChange={setOfferedFacilityInput}
                      placeholder="0.00"
                      disabled={
                        !isReviewable ||
                        !!isActionLocked ||
                        !onSendOffer ||
                        isContractApproved ||
                        isContractOfferSendLocked
                      }
                      className={contractReviewControlWidthClass}
                      inputClassName="h-9"
                      prefix="RM"
                      maxIntDigits={15}
                      allowEmpty={true}
                    />
                    {onSendOffer ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-9 w-full shrink-0 rounded-lg sm:w-auto"
                        disabled={
                          !isReviewable ||
                          !!isActionLocked ||
                          !!isSendOfferPending ||
                          !!facilityFeeRatePercentError ||
                          !!facilityFeeUpfrontError ||
                          !canSendContractOffer
                        }
                        onClick={assertLargePrivateThenOpenOffer}
                      >
                        {isSendOfferPending ? "Sending..." : "Send Offer"}
                      </Button>
                    ) : null}
                  </div>
                  {offerTimelineLine ? (
                    <p className="text-xs text-muted-foreground tabular-nums">{offerTimelineLine}</p>
                  ) : null}
                  {phaseDeadlineDisplay ? (
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        phaseDeadlineDisplay.urgency === "past"
                          ? "font-medium text-destructive"
                          : phaseDeadlineDisplay.urgency === "soon"
                            ? "font-medium text-amber-800"
                            : "text-muted-foreground"
                      )}
                    >
                      {phaseDeadlineDisplay.summary}
                    </p>
                  ) : null}
                  {offeredFacilityNotPositive && (
                    <p className="text-sm text-destructive">
                      Offered facility must be greater than 0.
                    </p>
                  )}
                  {facilityOfferBlockReason ? (
                    <p role="alert" className="text-sm text-destructive">
                      {facilityOfferBlockReason === REQUESTED_FACILITY_BELOW_CONTRACT_COPY
                        ? REQUESTED_FACILITY_BELOW_CONTRACT_COPY
                        : OFFERED_FACILITY_BELOW_CONTRACT_COPY}
                    </p>
                  ) : null}
                  {remainingCredit != null || remainingAllocation != null ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p className="text-meta text-muted-foreground">
                        {REMAINING_CREDIT_LABEL}:{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {remainingCredit != null ? formatCurrency(remainingCredit) : "—"}
                        </span>
                      </p>
                      <p className="text-meta text-muted-foreground">
                        {REMAINING_ALLOCATION_LABEL}:{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {remainingAllocation != null ? formatCurrency(remainingAllocation) : "—"}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 px-3 py-3">
                <p className="text-sm font-medium text-foreground">Facility fee</p>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-start">
                  <ReviewFieldLabel
                    htmlFor="facility-fee-rate-percent"
                    tooltip={FACILITY_FEE_RATE_FIELD_TOOLTIP}
                  >
                    Facility fee rate
                  </ReviewFieldLabel>
                  <div className="space-y-1.5">
                    <div className="flex w-full max-w-[11rem] items-center gap-1.5">
                      <input
                        id="facility-fee-rate-percent"
                        value={facilityFeeRatePercentInput}
                        onChange={(e) => setFacilityFeeRatePercentInput(e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        disabled={facilityFeeInputsDisabled}
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-right text-ui tabular-nums focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        aria-invalid={!!facilityFeeRatePercentError}
                      />
                      <span className="shrink-0 text-ui text-muted-foreground">%</span>
                    </div>
                    {facilityFeeRatePercentError ? (
                      <p className="text-sm text-destructive">{facilityFeeRatePercentError}</p>
                    ) : null}
                  </div>
                  <ReviewFieldLabel
                    htmlFor="facility-fee-upfront-collect"
                    tooltip={FACILITY_FEE_UPFRONT_FIELD_TOOLTIP}
                  >
                    Collect upfront now
                  </ReviewFieldLabel>
                  <div className="space-y-1.5">
                    <MoneyInput
                      id="facility-fee-upfront-collect"
                      value={facilityFeeUpfrontInput}
                      onValueChange={setFacilityFeeUpfrontInput}
                      placeholder="0.00"
                      disabled={facilityFeeInputsDisabled}
                      className="w-full max-w-[11rem]"
                      inputClassName="h-9"
                      prefix="RM"
                      maxIntDigits={15}
                      allowEmpty={true}
                      invalid={!!facilityFeeUpfrontError}
                    />
                    {facilityFeeUpfrontError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {facilityFeeUpfrontError}
                      </p>
                    ) : null}
                  </div>
                </div>
                <dl className="grid gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-ui">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Total facility fee</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(facilityFeeSplit.totalFacilityFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Upfront via payment gateway</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(facilityFeeSplit.upfrontAmount)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Left for later drawdowns</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(facilityFeeSplit.remainingForDrawdown)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </ReviewFieldBlock>

          {cd && (
            <ReviewFieldBlock title="Contract Details">
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Contract Title</Label>
                <div className={reviewValueClass}>{formatReviewValue(cd.title)}</div>
                <Label className={reviewLabelClass}>Contract Description</Label>
                <div className={reviewValueClassTextArea}>{formatReviewValue(cd.description)}</div>
                <Label className={reviewLabelClass}>Contract Number</Label>
                <div className={reviewValueClass}>{formatReviewValue(cd.number)}</div>
                <Label className={reviewLabelClass}>Contract Value</Label>
                <div className={reviewValueClass}>
                  {typeof cd.value === "number"
                    ? formatCurrency(cd.value)
                    : formatReviewValue(cd.value)}
                </div>
                <Label className={reviewLabelClass}>Contract Financing</Label>
                <div className={reviewValueClass}>
                  {typeof cd.financing === "number"
                    ? formatCurrency(cd.financing)
                    : formatReviewValue(cd.financing)}
                </div>
                <Label className={reviewLabelClass}>Contract Start Date</Label>
                <div className={reviewValueClass}>{formatReviewDate(cd.start_date as string)}</div>
                <Label className={reviewLabelClass}>Contract End Date</Label>
                <div className={reviewValueClass}>{formatReviewDate(cd.end_date as string)}</div>
                {approvedShown > 0 ? (
                  <>
                    <Label className={reviewLabelClass}>Approved Facility</Label>
                    <div className={reviewValueClass}>{formatCurrency(approvedShown)}</div>
                    <Label className={reviewLabelClass}>Utilized</Label>
                    <div className={reviewValueClass}>{formatCurrency(utilizedShown)}</div>
                    <Label className={reviewLabelClass}>{RESERVED_LABEL}</Label>
                    <div className={reviewValueClass}>{formatCurrency(reservedShown)}</div>
                    <Label className={reviewLabelClass}>{REMAINING_CREDIT_LABEL}</Label>
                    <div className={reviewValueClass}>{formatCurrency(availableShown)}</div>
                    {remainingAllocation != null ? (
                      <>
                        <Label className={reviewLabelClass}>{REMAINING_ALLOCATION_LABEL}</Label>
                        <div className={reviewValueClass}>{formatCurrency(remainingAllocation)}</div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </ReviewFieldBlock>
          )}

          {cust && showIdentityComparison ? (
            <SubmittedVerifiedPaymasterIdentity
              customerDetails={cust}
              paymaster={paymaster}
              applicationId={applicationId}
              canManage={canManagePaymasters}
              actionsDisabled={!isReviewable || !!isActionLocked}
              onRequestAmendment={() => onRequestAmendment(section)}
            />
          ) : null}

          {cust && (
            <ReviewFieldBlock title="Customer Details">
              <div className={reviewRowGridClass}>
                {!showIdentityComparison ? (
                  <>
                    <Label className={reviewLabelClass}>Customer Name</Label>
                    <div className={reviewValueClass}>{formatReviewValue(cust.name)}</div>
                    <Label className={reviewLabelClass}>Customer Entity Type</Label>
                    <div className={reviewValueClass}>{formatReviewValue(cust.entity_type)}</div>
                  </>
                ) : null}
                <Label htmlFor="customer-large-private-company" className={reviewLabelClass}>
                  Is Customer a Large Private Company?{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className={cn("flex flex-col gap-1.5", contractReviewControlWidthClass)}>
                  <Select
                    value={
                      largePrivateCompany === null
                        ? undefined
                        : largePrivateCompany
                          ? "yes"
                          : "no"
                    }
                    onValueChange={(v) => {
                      if (v === "yes") void persistLargePrivate(true);
                      if (v === "no") void persistLargePrivate(false);
                    }}
                    disabled={
                      !isReviewable ||
                      !!isActionLocked ||
                      isContractApproved ||
                      isContractOfferSendLocked ||
                      patchLargePrivate.isPending
                    }
                  >
                    <SelectTrigger
                      id="customer-large-private-company"
                      className={cn(
                        "h-9 rounded-lg text-left text-sm font-normal",
                        contractReviewControlWidthClass,
                        largePrivateHighlight &&
                          "ring-2 ring-destructive ring-offset-2 ring-offset-background"
                      )}
                      aria-invalid={largePrivateHighlight}
                    >
                      <SelectValue placeholder="Choose Yes or No" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="yes" className="rounded-lg">
                        Yes
                      </SelectItem>
                      <SelectItem value="no" className="rounded-lg">
                        No
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Required before you can send the facility offer.
                  </p>
                </div>
                {!showIdentityComparison ? (
                  <>
                    <Label className={reviewLabelClass}>Customer SSM Number</Label>
                    <div className={reviewValueClass}>{formatReviewValue(cust.ssm_number)}</div>
                    <Label className={reviewLabelClass}>Customer Country</Label>
                    <div className={reviewValueClass}>{formatReviewValue(cust.country)}</div>
                  </>
                ) : null}
                <Label className={reviewLabelClass}>Is Customer Related to Issuer?</Label>
                <div className={reviewValueClass}>
                  {cust.is_related_party === true
                    ? "Yes"
                    : cust.is_related_party === false
                      ? "No"
                      : REVIEW_EMPTY_LABEL}
                </div>
              </div>
            </ReviewFieldBlock>
          )}

          {cust ? (
            <ReviewFieldBlock title="Paymaster Verification">
              <PaymasterVerificationPanel
                paymaster={paymaster}
                paymasterId={paymasterId}
                customerDetails={customerDetails}
                applicationId={applicationId}
                canManage={canManagePaymasters}
              />
            </ReviewFieldBlock>
          ) : null}

          <ReviewFieldBlock title="Evidence">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Contract Document</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {contractDoc?.file_name
                        ? `${contractDoc.file_name}${
                            contractDoc.file_size
                              ? ` (${formatFileSize(contractDoc.file_size)})`
                              : ""
                          }`
                        : REVIEW_EMPTY_LABEL}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {contractDoc?.s3_key && onViewDocument && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg h-9 gap-1"
                      onClick={() => onViewDocument(contractDoc.s3_key!)}
                      disabled={viewDocumentPending}
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      View
                    </Button>
                  )}
                  {contractDoc?.s3_key && onDownloadDocument && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg h-9 gap-1"
                      onClick={() =>
                        onDownloadDocument(contractDoc.s3_key!, contractDoc.file_name)
                      }
                      disabled={viewDocumentPending}
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </ReviewFieldBlock>
        </>
      ) : (
        <p className={reviewEmptyStateClass}>No facility details submitted.</p>
      )}
      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}

      <Dialog open={contractOfferConfirmOpen} onOpenChange={setContractOfferConfirmOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Facility Offer</DialogTitle>
            <DialogDescription>
              Review the offer details below before sending to the issuer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract value</span>
              <span className="font-medium tabular-nums">
                {contractValue > 0 ? formatCurrency(contractValue) : REVIEW_EMPTY_LABEL}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requested facility</span>
              <span className="font-medium tabular-nums">
                {requestedFacility > 0 ? formatCurrency(requestedFacility) : REVIEW_EMPTY_LABEL}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Offered facility</span>
              <span className="font-medium tabular-nums">{formatCurrency(offeredFacility)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Facility fee rate</span>
              <span className="font-medium tabular-nums">
                {facilityFeeRatePercentParsed == null ? "—" : `${facilityFeeRatePercentParsed}%`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total facility fee</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(facilityFeeSplit.totalFacilityFee)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Upfront via payment gateway</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(facilityFeeSplit.upfrontAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining for drawdown collections</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(facilityFeeSplit.remainingForDrawdown)}
              </span>
            </div>
            {acceptanceDeadlinePreview ? (
              <OfferAcceptanceDeadlineConfirmRows preview={acceptanceDeadlinePreview} />
            ) : null}
            {facilityOfferBlockReason ? (
              <p className="mt-2 text-sm text-destructive">{facilityOfferBlockReason}</p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setContractOfferConfirmOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmContractOffer}
              disabled={
                !canSendContractOffer ||
                !!isSendOfferPending ||
                !!facilityFeeRatePercentError ||
                !!facilityFeeUpfrontError
              }
              className="rounded-xl"
            >
              {isSendOfferPending ? "Sending..." : "Confirm & Send Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReviewSectionCard>
  );
}
