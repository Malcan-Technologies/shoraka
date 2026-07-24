"use client";

import * as React from "react";
import { ChevronDownIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function PoolSummaryCard({
  label,
  value,
  description,
  emphasized = false,
}: {
  label: string;
  value: number;
  description: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5",
        emphasized ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/10"
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          emphasized && "text-primary"
        )}
      >
        {formatCurrency(value)}
      </div>
      <div className="mt-0.5 line-clamp-3 text-[10px] leading-3 text-muted-foreground">
        {description}
      </div>
    </div>
  );
}

export function BeneficiaryDetailsBlock({
  accountHolder,
  bankName,
  accountNumber,
  onEdit,
  showEdit = false,
  readOnlyHint,
}: {
  accountHolder: React.ReactNode;
  bankName: React.ReactNode;
  accountNumber: React.ReactNode;
  onEdit?: () => void;
  showEdit?: boolean;
  readOnlyHint?: string;
}) {
  return (
    <div className="mt-2 rounded-md border bg-muted/30 px-2.5 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">Beneficiary details</div>
        {showEdit && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : null}
      </div>
      {readOnlyHint ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{readOnlyHint}</p>
      ) : null}
      <dl className="mt-1.5 space-y-1 text-muted-foreground">
        <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5">
          <dt>Payee / account holder</dt>
          <dd className="font-medium text-foreground">{accountHolder}</dd>
        </div>
        <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5">
          <dt>Bank name</dt>
          <dd className="font-medium text-foreground">{bankName}</dd>
        </div>
        <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5">
          <dt>Account number</dt>
          <dd className="font-medium text-foreground">{accountNumber}</dd>
        </div>
      </dl>
    </div>
  );
}

export function CollapsibleDetailTimeline({
  rows,
  defaultOpen = false,
  title = "Timeline",
}: {
  rows: { label: string; value: React.ReactNode }[];
  defaultOpen?: boolean;
  title?: string;
}) {
  const visibleRows = rows.filter((row) => row.value != null && row.value !== "");
  if (visibleRows.length === 0) return null;

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="mt-2 rounded-md border bg-muted/30 px-2.5 py-2 text-xs"
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left font-medium">
        <span>{title}</span>
        <ChevronDownIcon
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="mt-1.5 space-y-1 text-muted-foreground">
          {visibleRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5"
            >
              <dt>{row.label}</dt>
              <dd className="font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}
