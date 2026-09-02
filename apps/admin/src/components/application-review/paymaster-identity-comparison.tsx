"use client";

import { toast } from "sonner";
import {
  paymasterMasterIdentityFields,
  submittedIdentityDiffersFromVerified,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { useVerifiedPaymasterIdentity } from "@/paymasters/hooks/use-paymasters";
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
  applicationId,
  canManage,
  actionsDisabled,
  onRequestAmendment,
}: {
  customerDetails?: unknown;
  paymaster?: ApplicationReviewPaymaster | null;
  applicationId?: string;
  canManage: boolean;
  actionsDisabled?: boolean;
  onRequestAmendment: () => void;
}) {
  const useVerified = useVerifiedPaymasterIdentity();
  const submitted = asRecord(customerDetails) ?? {};
  const verified = paymaster ? paymasterMasterIdentityFields(paymaster) : null;

  const onUseVerified = async () => {
    if (!applicationId) return;
    try {
      await useVerified.mutateAsync({ applicationId });
      toast.success("Submitted customer identity now matches the verified Paymaster.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not use the verified Paymaster.");
    }
  };

  return (
    <ReviewFieldBlock title="Paymaster identity">
      <div className="space-y-2">
        <div className={comparisonSplitRowGridClass}>
          <p className={`${reviewLabelClass} ${comparisonSplitBeforeColClass}`}>Submitted</p>
          <p className={`${reviewLabelClass} ${comparisonSplitAfterColClass}`}>Verified Paymaster</p>
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
        {canManage && applicationId ? (
          <Button
            type="button"
            className="h-10 rounded-xl text-ui"
            disabled={actionsDisabled || useVerified.isPending}
            onClick={() => void onUseVerified()}
          >
            {useVerified.isPending ? "Updating…" : "Use Verified Paymaster"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl text-ui"
          disabled={actionsDisabled || useVerified.isPending}
          onClick={onRequestAmendment}
        >
          Request Amendment
        </Button>
      </div>
    </ReviewFieldBlock>
  );
}
