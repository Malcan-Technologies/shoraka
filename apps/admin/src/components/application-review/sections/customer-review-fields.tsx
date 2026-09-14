"use client";

import { Label } from "@/components/ui/label";
import { ReviewFieldBlock } from "../review-field-block";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewRowGridClass,
  reviewEmptyStateClass,
  REVIEW_EMPTY_LABEL,
  formatReviewValue,
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";
import { PaymasterVerificationPanel, type ApplicationReviewPaymaster } from "@/paymasters/components/paymaster-verification-panel";
import {
  shouldShowSubmittedVerifiedPaymaster,
  SubmittedVerifiedPaymasterIdentity,
} from "../paymaster-identity-comparison";
import { usePermissions } from "@/hooks/use-permissions";

export type CustomerReviewFieldsProps = {
  customerDetails?: unknown;
  section: ReviewSectionId;
  isReviewable: boolean;
  isActionLocked?: boolean;
  onRequestAmendment: (section: ReviewSectionId) => void;
  paymaster?: ApplicationReviewPaymaster | null;
  paymasterId?: string | null;
  applicationId?: string;
};

/** Live (non-comparison) Customer tab body — identity, details, paymaster. */
export function CustomerReviewFields({
  customerDetails,
  section,
  isReviewable,
  isActionLocked,
  onRequestAmendment,
  paymaster,
  paymasterId,
  applicationId,
}: CustomerReviewFieldsProps) {
  const { can } = usePermissions();
  const canManagePaymasters = can("paymasters.manage");
  const cust = customerDetails as Record<string, unknown> | null | undefined;
  const showIdentityComparison = shouldShowSubmittedVerifiedPaymaster({
    customerDetails: cust,
    paymaster,
  });

  if (!cust) {
    return <p className={reviewEmptyStateClass}>No customer details submitted.</p>;
  }

  return (
    <>
      {showIdentityComparison ? (
        <SubmittedVerifiedPaymasterIdentity
          customerDetails={cust}
          paymaster={paymaster}
          actionsDisabled={!isReviewable || !!isActionLocked}
          onRequestAmendment={() => onRequestAmendment(section)}
        />
      ) : null}
      <ReviewFieldBlock title="Customer Details">
        <div className={reviewRowGridClass}>
          {!showIdentityComparison ? (
            <>
              <Label className={reviewLabelClass}>Customer Name</Label>
              <div className={reviewValueClass}>{formatReviewValue(cust.name)}</div>
              <Label className={reviewLabelClass}>Customer Entity Type</Label>
              <div className={reviewValueClass}>{formatReviewValue(cust.entity_type)}</div>
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
      <ReviewFieldBlock title="Paymaster Verification">
        <PaymasterVerificationPanel
          paymaster={paymaster}
          paymasterId={paymasterId}
          customerDetails={customerDetails}
          applicationId={applicationId}
          canManage={canManagePaymasters}
        />
      </ReviewFieldBlock>
    </>
  );
}
