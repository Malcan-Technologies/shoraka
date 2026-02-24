"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { format } from "date-fns";
import { SectionActionDropdown } from "../section-action-dropdown";
import type { ReviewSectionId } from "../section-types";

const EMPTY_LABEL = "Not provided";

/** Typography aligned with other review sections. */
const rowGridClass =
  "grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-8 gap-y-4 mt-3 w-full items-start";
const labelClass = "text-sm font-normal text-foreground";
const valueClass =
  "min-h-[36px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground flex items-center";

function formatValue(v: unknown): string {
  if (v == null || v === "") return EMPTY_LABEL;
  if (typeof v === "number") return Number.isNaN(v) ? EMPTY_LABEL : formatCurrency(v);
  if (typeof v === "string") return v.trim() || EMPTY_LABEL;
  return String(v);
}

export interface ContractSectionProps {
  contractDetails: unknown;
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
}

export function ContractSection({
  contractDetails,
  section,
  isReviewable,
  approvePending,
  onApprove,
  onReject,
  onRequestAmendment,
}: ContractSectionProps) {
  const cd = contractDetails as Record<string, unknown> | null | undefined;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Contract</CardTitle>
          </div>
          <SectionActionDropdown
            section={section}
            isReviewable={isReviewable}
            onApprove={onApprove}
            onReject={onReject}
            onRequestAmendment={onRequestAmendment}
            isPending={approvePending}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {cd ? (
          <div className={rowGridClass}>
            <Label className={labelClass}>Title</Label>
            <div className={valueClass}>{formatValue(cd.title)}</div>
            <Label className={labelClass}>Contract number</Label>
            <div className={valueClass}>{formatValue(cd.number)}</div>
            <Label className={labelClass}>Value</Label>
            <div className={valueClass}>
              {typeof cd.value === "number" ? formatCurrency(cd.value) : formatValue(cd.value)}
            </div>
            <Label className={labelClass}>Approved facility</Label>
            <div className={valueClass}>
              {typeof cd.approved_facility === "number"
                ? formatCurrency(cd.approved_facility)
                : formatValue(cd.approved_facility)}
            </div>
            <Label className={labelClass}>Start date</Label>
            <div className={valueClass}>
              {cd.start_date
                ? format(new Date(String(cd.start_date)), "dd MMM yyyy")
                : EMPTY_LABEL}
            </div>
            <Label className={labelClass}>End date</Label>
            <div className={valueClass}>
              {cd.end_date ? format(new Date(String(cd.end_date)), "dd MMM yyyy") : EMPTY_LABEL}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No contract details submitted.</p>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">Add Remarks</Label>
          <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
        </div>
      </CardContent>
    </Card>
  );
}
