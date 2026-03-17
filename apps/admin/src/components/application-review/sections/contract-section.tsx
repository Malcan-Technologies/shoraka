"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@cashsouk/ui";
import { formatMoney, parseMoney } from "@/app/settings/products/components/money";
import { DocumentTextIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { formatCurrency, resolveRequestedFacility, resolveOfferedFacility } from "@cashsouk/config";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewValueClassTextArea,
  reviewRowGridClass,
  REVIEW_EMPTY_LABEL,
  formatReviewValue,
  formatReviewDate,
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";

interface FileDoc {
  s3_key?: string;
  file_name?: string;
  file_size?: number;
}

export interface ContractSectionProps {
  contractDetails: unknown;
  offerDetails?: unknown;
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
  onSendOffer?: (payload: { offeredFacility: number }) => Promise<void>;
  isSendOfferPending?: boolean;
  onViewDocument?: (s3Key: string) => void;
  viewDocumentPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
}

export function ContractSection({
  contractDetails,
  offerDetails,
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
  isSendOfferPending,
  onViewDocument,
  viewDocumentPending,
  comments,
  onAddComment,
}: ContractSectionProps) {
  const cd = contractDetails as Record<string, unknown> | null | undefined;
  const offer = offerDetails as Record<string, unknown> | null | undefined;
  const cust = customerDetails as Record<string, unknown> | null | undefined;

  const contractDoc = cd?.document as FileDoc | undefined;
  const customerDoc = cust?.document as FileDoc | undefined;
  const requestedFacility = resolveRequestedFacility(cd);
  const contractValue = typeof cd?.value === "number" ? cd.value : 0;
  const offeredOrRequested = resolveOfferedFacility(offer) || requestedFacility;
  const initialOffered = formatMoney(offeredOrRequested);
  const [offeredFacilityInput, setOfferedFacilityInput] = React.useState<string>(initialOffered);
  const [contractOfferConfirmOpen, setContractOfferConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    setOfferedFacilityInput(formatMoney(offeredOrRequested));
  }, [offeredOrRequested]);

  const hasData = cd || cust;
  const offeredFacility = parseMoney(offeredFacilityInput);
  const offeredExceedsContractValue = contractValue > 0 && offeredFacility > contractValue;
  const isContractApproved = sectionStatus === "APPROVED";
  const isContractFinalizedByIssuer = isContractApproved;
  const canSendContractOffer =
    !isContractApproved && offeredFacility > 0 && !offeredExceedsContractValue;

  const handleConfirmContractOffer = React.useCallback(async () => {
    if (!onSendOffer || !canSendContractOffer) return;
    await onSendOffer({ offeredFacility });
    setContractOfferConfirmOpen(false);
  }, [onSendOffer, offeredFacility, canSendContractOffer]);

  return (
    <ReviewSectionCard
      title="Contract Details"
      icon={DocumentTextIcon}
      section={section}
      isReviewable={isReviewable}
      approvePending={approvePending}
      isActionLocked={isActionLocked || isContractFinalizedByIssuer}
      actionLockTooltip={
        isContractFinalizedByIssuer
          ? "Contract offer finalized by issuer. No further admin actions are allowed."
          : actionLockTooltip
      }
      sectionStatus={sectionStatus}
      onResetToPending={onResetSectionToPending}
      onApprove={onApprove}
      onReject={onReject}
      onRequestAmendment={onRequestAmendment}
      showApprove={false}
    >
      {hasData ? (
        <>
          <ReviewFieldBlock title="Offer to Issuer">
            <div className="space-y-3">
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Requested facility</Label>
                <div className={reviewValueClass}>
                  {requestedFacility > 0 ? formatCurrency(requestedFacility) : REVIEW_EMPTY_LABEL}
                </div>
                <Label className={reviewLabelClass}>Offered facility</Label>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                  <MoneyInput
                    value={offeredFacilityInput}
                    onValueChange={setOfferedFacilityInput}
                    placeholder="0.00"
                    disabled={
                      !isReviewable ||
                      !!isActionLocked ||
                      !onSendOffer ||
                      isContractApproved
                    }
                    inputClassName="h-9 w-[220px]"
                    prefix="RM"
                    maxIntDigits={12}
                    allowEmpty={true}
                  />
                  {onSendOffer && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={
                        !isReviewable ||
                        !!isActionLocked ||
                        !!isSendOfferPending ||
                        !canSendContractOffer
                      }
                      onClick={() => setContractOfferConfirmOpen(true)}
                    >
                      {isSendOfferPending ? "Sending..." : "Send Offer"}
                    </Button>
                  )}
                  </div>
                  {offeredExceedsContractValue && (
                    <p className="text-sm text-destructive">
                      Offered facility cannot exceed contract value.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ReviewFieldBlock>

          {cd && (
            <ReviewFieldBlock title="Contract details">
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Contract title</Label>
                <div className={reviewValueClass}>{formatReviewValue(cd.title)}</div>
                <Label className={reviewLabelClass}>Contract description</Label>
                <div className={reviewValueClassTextArea}>{formatReviewValue(cd.description)}</div>
                <Label className={reviewLabelClass}>Contract number</Label>
                <div className={reviewValueClass}>{formatReviewValue(cd.number)}</div>
                <Label className={reviewLabelClass}>Contract value</Label>
                <div className={reviewValueClass}>
                  {typeof cd.value === "number"
                    ? formatCurrency(cd.value)
                    : formatReviewValue(cd.value)}
                </div>
                <Label className={reviewLabelClass}>Contract financing</Label>
                <div className={reviewValueClass}>
                  {typeof cd.financing === "number"
                    ? formatCurrency(cd.financing)
                    : formatReviewValue(cd.financing)}
                </div>
                <Label className={reviewLabelClass}>Contract start date</Label>
                <div className={reviewValueClass}>{formatReviewDate(cd.start_date as string)}</div>
                <Label className={reviewLabelClass}>Contract end date</Label>
                <div className={reviewValueClass}>{formatReviewDate(cd.end_date as string)}</div>
                {typeof cd.approved_facility === "number" && cd.approved_facility > 0 && (
                  <>
                    <Label className={reviewLabelClass}>Approved facility</Label>
                    <div className={reviewValueClass}>
                      {formatCurrency(cd.approved_facility as number)}
                    </div>
                    <Label className={reviewLabelClass}>Utilized facility</Label>
                    <div className={reviewValueClass}>
                      {formatCurrency(
                        typeof cd.utilized_facility === "number" ? cd.utilized_facility : 0
                      )}
                    </div>
                    <Label className={reviewLabelClass}>Available facility</Label>
                    <div className={reviewValueClass}>
                      {formatCurrency(
                        typeof cd.available_facility === "number" ? cd.available_facility : 0
                      )}
                    </div>
                  </>
                )}
              </div>
            </ReviewFieldBlock>
          )}

          {cust && (
            <ReviewFieldBlock title="Customer details">
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Customer name</Label>
                <div className={reviewValueClass}>{formatReviewValue(cust.name)}</div>
                <Label className={reviewLabelClass}>Customer entity type</Label>
                <div className={reviewValueClass}>{formatReviewValue(cust.entity_type)}</div>
                <Label className={reviewLabelClass}>Customer SSM number</Label>
                <div className={reviewValueClass}>{formatReviewValue(cust.ssm_number)}</div>
                <Label className={reviewLabelClass}>Customer country</Label>
                <div className={reviewValueClass}>{formatReviewValue(cust.country)}</div>
                <Label className={reviewLabelClass}>Is customer related to issuer?</Label>
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

          <ReviewFieldBlock title="Evidence">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Contract document</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {contractDoc?.file_name
                        ? `${contractDoc.file_name}${
                            contractDoc.file_size
                              ? ` (${(contractDoc.file_size / 1024 / 1024).toFixed(2)} MB)`
                              : ""
                          }`
                        : REVIEW_EMPTY_LABEL}
                    </div>
                  </div>
                </div>
                {contractDoc?.s3_key && onViewDocument && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-9 gap-1 shrink-0"
                    onClick={() => onViewDocument(contractDoc.s3_key!)}
                    disabled={viewDocumentPending}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    View
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Customer consent</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {customerDoc?.file_name
                        ? `${customerDoc.file_name}${
                            customerDoc.file_size
                              ? ` (${(customerDoc.file_size / 1024 / 1024).toFixed(2)} MB)`
                              : ""
                          }`
                        : REVIEW_EMPTY_LABEL}
                    </div>
                  </div>
                </div>
                {customerDoc?.s3_key && onViewDocument && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-9 gap-1 shrink-0"
                    onClick={() => onViewDocument(customerDoc.s3_key!)}
                    disabled={viewDocumentPending}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    View
                  </Button>
                )}
              </div>
            </div>
          </ReviewFieldBlock>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No contract details submitted.</p>
      )}
      <SectionComments comments={comments} onSubmitComment={onAddComment} />

      <Dialog open={contractOfferConfirmOpen} onOpenChange={setContractOfferConfirmOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Contract Offer</DialogTitle>
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
            {offeredExceedsContractValue && (
              <p className="mt-2 text-sm text-destructive">
                Offered facility cannot exceed contract value.
              </p>
            )}
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
              disabled={!canSendContractOffer || !!isSendOfferPending}
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
