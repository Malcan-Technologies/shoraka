"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency, resolveApprovedFacility } from "@cashsouk/config";
import { type ContractProductRules } from "@cashsouk/types";
import {
  REMAINING_ALLOCATION_LABEL,
  REMAINING_CREDIT_LABEL,
  RESERVED_LABEL,
} from "@/lib/facility-capacity-display";
import { ReviewFieldBlock } from "../review-field-block";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewValueClassTextArea,
  reviewRowGridClass,
  REVIEW_EMPTY_LABEL,
  formatReviewValue,
  formatReviewDate,
  formatFileSize,
} from "../review-section-styles";
import { parseFacilityAmount } from "@/contracts/utils/contract-facility-metrics";
import type { ReviewSectionId } from "../section-types";
import { PaymasterVerificationPanel, type ApplicationReviewPaymaster } from "@/paymasters/components/paymaster-verification-panel";
import {
  shouldShowSubmittedVerifiedPaymaster,
  SubmittedVerifiedPaymasterIdentity,
} from "../paymaster-identity-comparison";
import { usePermissions } from "@/hooks/use-permissions";

interface FileDoc {
  s3_key?: string;
  file_name?: string;
  file_size?: number;
}

export type ContractReviewFieldsProps = {
  contractDetails?: unknown;
  customerDetails?: unknown;
  contractStatus?: string;
  section: ReviewSectionId;
  isReviewable: boolean;
  isActionLocked?: boolean;
  onRequestAmendment: (section: ReviewSectionId) => void;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
  contractProductRules?: ContractProductRules;
  reviewOccupancy?: {
    remainingCredit: number;
    remainingAllocation: number;
    reservedFacility: number;
  };
  paymaster?: ApplicationReviewPaymaster | null;
  paymasterId?: string | null;
  applicationId?: string;
  /** Inserted inside Customer Details after name/entity (large-private select). */
  customerDetailsExtra?: React.ReactNode;
};

/**
 * Read-only Facility review grids (contract / customer / paymaster / evidence).
 * Offer inputs stay in ContractSection so send-offer state is not duplicated.
 */
export function ContractReviewFields({
  contractDetails,
  customerDetails,
  contractStatus,
  section,
  isReviewable,
  isActionLocked,
  onRequestAmendment,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
  contractProductRules,
  reviewOccupancy,
  paymaster,
  paymasterId,
  applicationId,
  customerDetailsExtra,
}: ContractReviewFieldsProps) {
  const { can } = usePermissions();
  const canManagePaymasters = can("paymasters.manage");
  const cd = contractDetails as Record<string, unknown> | null | undefined;
  const cust = customerDetails as Record<string, unknown> | null | undefined;
  const showIdentityComparison = shouldShowSubmittedVerifiedPaymaster({
    customerDetails: cust,
    paymaster,
  });
  const contractDoc = cd?.document as FileDoc | undefined;
  const approvedShown = resolveApprovedFacility(contractStatus ?? "", cd);
  const utilizedShown = parseFacilityAmount(cd?.utilized_facility) ?? 0;
  const reservedShown =
    reviewOccupancy?.reservedFacility ?? parseFacilityAmount(cd?.pending_facility) ?? 0;
  const availableShown =
    reviewOccupancy?.remainingCredit ??
    parseFacilityAmount(cd?.available_facility) ??
    (approvedShown > 0 ? approvedShown - utilizedShown - reservedShown : 0);
  const remainingAllocation =
    reviewOccupancy?.remainingAllocation ?? parseFacilityAmount(cd?.lifetime_remaining);

  return (
    <>
      {cd ? (
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
              {typeof cd.value === "number" ? formatCurrency(cd.value) : formatReviewValue(cd.value)}
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
            {contractProductRules?.minContractMonths != null ? (
              <>
                <Label className={reviewLabelClass}>Minimum facility duration</Label>
                <div className={reviewValueClass}>{contractProductRules.minContractMonths} months</div>
              </>
            ) : null}
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
      ) : null}

      {cust && showIdentityComparison ? (
        <SubmittedVerifiedPaymasterIdentity
          customerDetails={cust}
          paymaster={paymaster}
          actionsDisabled={!isReviewable || !!isActionLocked}
          onRequestAmendment={() => onRequestAmendment(section)}
        />
      ) : null}

      {cust ? (
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
            {customerDetailsExtra}
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
      ) : null}

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
                        contractDoc.file_size ? ` (${formatFileSize(contractDoc.file_size)})` : ""
                      }`
                    : REVIEW_EMPTY_LABEL}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {contractDoc?.s3_key && onViewDocument ? (
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
              ) : null}
              {contractDoc?.s3_key && onDownloadDocument ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-9 gap-1"
                  onClick={() => onDownloadDocument(contractDoc.s3_key!, contractDoc.file_name)}
                  disabled={viewDocumentPending}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </ReviewFieldBlock>
    </>
  );
}
