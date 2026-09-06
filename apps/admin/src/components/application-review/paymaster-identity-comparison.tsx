"use client";

import {
  paymasterMasterIdentityFields,
  submittedIdentityDiffersFromVerified,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import type { ApplicationReviewPaymaster } from "@/paymasters/components/paymaster-verification-panel";
import { ComparisonFieldRow } from "./comparison-field-row";
import { ReviewFieldBlock } from "./review-field-block";
import {
  comparisonSplitAfterColClass,
  comparisonSplitBeforeColClass,
  comparisonSplitRowGridClass,
  formatReviewValue,
  reviewLabelClass,
} from "./review-section-styles";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function shouldShowSubmittedVerifiedPaymaster(params: {
  customerDetails?: unknown;
  paymaster?: ApplicationReviewPaymaster | null;
}): boolean {
  return submittedIdentityDiffersFromVerified({
    submitted: asRecord(params.customerDetails),
    paymaster: params.paymaster,
  });
}

export function SubmittedVerifiedPaymasterIdentity({
  customerDetails,
  paymaster,
  actionsDisabled,
  onRequestAmendment,
}: {
  customerDetails?: unknown;
  paymaster?: ApplicationReviewPaymaster | null;
  applicationId?: string;
  canManage?: boolean;
  actionsDisabled?: boolean;
  onRequestAmendment: () => void;
}) {
  const submitted = asRecord(customerDetails) ?? {};
  const verified = paymaster ? paymasterMasterIdentityFields(paymaster) : null;

  return (
    <ReviewFieldBlock title="Paymaster identity">
      <div className="space-y-2">
        <div className={comparisonSplitRowGridClass}>
          <p className={`${reviewLabelClass} ${comparisonSplitBeforeColClass}`}>
            Originally submitted by issuer
          </p>
          <p className={`${reviewLabelClass} ${comparisonSplitAfterColClass}`}>
            Official Paymaster Identity
          </p>
        </div>
        <ComparisonFieldRow
          label="Customer Name"
          before={formatReviewValue(submitted.name)}
          after={formatReviewValue(verified?.name)}
          changed
        />
        <ComparisonFieldRow
          label="Customer Entity Type"
          before={formatReviewValue(submitted.entity_type)}
          after={formatReviewValue(verified?.entity_type)}
          changed
        />
        <ComparisonFieldRow
          label="Customer SSM Number"
          before={formatReviewValue(submitted.ssm_number)}
          after={formatReviewValue(verified?.ssm_number)}
          changed
        />
        <ComparisonFieldRow
          label="Customer Country"
          before={formatReviewValue(submitted.country)}
          after={formatReviewValue(verified?.country)}
          changed
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl text-ui"
          disabled={actionsDisabled}
          onClick={onRequestAmendment}
        >
          Request Amendment
        </Button>
      </div>
    </ReviewFieldBlock>
  );
}
