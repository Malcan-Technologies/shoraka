"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { ApplicationStepKey } from "@cashsouk/types";

const sectionHeaderClass = "text-sm font-semibold";
const rowGridClass =
  "grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-8 gap-y-4 mt-3 w-full items-start";
const labelClass = "text-sm font-normal text-foreground";
const valueClass =
  "min-h-[36px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground flex items-center";

export interface StepSummarySectionProps {
  stepKey: ApplicationStepKey | string;
  stepLabel: string;
  app: {
    financing_type?: unknown;
    financing_structure?: unknown;
    company_details?: unknown;
    contract?: { contract_details?: unknown; customer_details?: unknown } | null;
    invoices?: { id: string; details?: unknown }[];
    declarations?: unknown;
    issuer_organization?: unknown;
  };
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isNaN(v) ? "—" : String(v);
  if (typeof v === "string") return v.trim() || "—";
  return JSON.stringify(v);
}

export function StepSummarySection({ stepKey, stepLabel, app }: StepSummarySectionProps) {
  const renderContent = () => {
    switch (stepKey) {
      case "financing_type": {
        const ft = app.financing_type as Record<string, unknown> | undefined;
        const name = ft?.product_name ?? ft?.name ?? "—";
        const category = ft?.category ?? "—";
        const description = ft?.description ?? "—";
        return (
          <div className={rowGridClass}>
            <Label className={labelClass}>Product</Label>
            <div className={valueClass}>{formatValue(name)}</div>
            <Label className={labelClass}>Category</Label>
            <div className={valueClass}>{formatValue(category)}</div>
            <Label className={labelClass}>Description</Label>
            <div className={`${valueClass} min-h-[60px] items-start`}>{formatValue(description)}</div>
          </div>
        );
      }
      case "financing_structure": {
        const fs = app.financing_structure as Record<string, unknown> | undefined;
        const type = fs?.structure_type ?? "—";
        const label =
          type === "new_contract" ? "New contract" : type === "existing_contract" ? "Existing contract" : formatValue(type);
        return (
          <div className={rowGridClass}>
            <Label className={labelClass}>Structure type</Label>
            <div className={valueClass}>{label}</div>
          </div>
        );
      }
      case "contract_details": {
        const cd = app.contract?.contract_details as Record<string, unknown> | undefined;
        const cust = app.contract?.customer_details as Record<string, unknown> | undefined;
        if (!cd && !cust) return <p className="text-sm text-muted-foreground">No contract details.</p>;
        return (
          <div className={rowGridClass}>
            <Label className={labelClass}>Contract title</Label>
            <div className={valueClass}>{formatValue(cd?.title)}</div>
            <Label className={labelClass}>Customer</Label>
            <div className={valueClass}>{formatValue(cust?.name)}</div>
            <Label className={labelClass}>Contract value</Label>
            <div className={valueClass}>
              {typeof cd?.value === "number" ? formatCurrency(cd.value) : formatValue(cd?.value)}
            </div>
            <Label className={labelClass}>Approved facility</Label>
            <div className={valueClass}>
              {typeof cd?.approved_facility === "number"
                ? formatCurrency(cd.approved_facility)
                : formatValue(cd?.approved_facility)}
            </div>
          </div>
        );
      }
      case "invoice_details": {
        const invoices = app.invoices ?? [];
        if (invoices.length === 0) return <p className="text-sm text-muted-foreground">No invoices.</p>;
        return (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const d = inv.details as Record<string, unknown> | undefined;
              const value = typeof d?.value === "number" ? formatCurrency(d.value) : formatValue(d?.value);
              const ratio = d?.financing_ratio_percent ?? "—";
              return (
                <div key={inv.id} className="rounded-lg border border-input bg-background p-3 space-y-2">
                  <div className={rowGridClass}>
                    <Label className={labelClass}>Invoice value</Label>
                    <div className={valueClass}>{value}</div>
                    <Label className={labelClass}>Financing ratio</Label>
                    <div className={valueClass}>{formatValue(ratio)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case "company_details": {
        const org = app.issuer_organization as Record<string, unknown> | undefined;
        const name = org?.name ?? "—";
        return (
          <div className={rowGridClass}>
            <Label className={labelClass}>Organization name</Label>
            <div className={valueClass}>{formatValue(name)}</div>
            <Label className={labelClass}>Company details</Label>
            <div className={`${valueClass} min-h-[60px] items-start`}>
              {org ? "See Director & Shareholders in Financial tab" : "—"}
            </div>
          </div>
        );
      }
      case "declarations": {
        const decl = app.declarations as unknown[] | Record<string, unknown> | undefined;
        const list = Array.isArray(decl) ? decl : decl && typeof decl === "object" ? [] : [];
        if (list.length === 0) return <p className="text-sm text-muted-foreground">No declarations.</p>;
        return (
          <div className="space-y-3">
            {list.map((item, i) => {
              const text =
                typeof item === "object" && item != null && "text" in item
                  ? String((item as { text: unknown }).text ?? "")
                  : typeof item === "string"
                    ? item
                    : "";
              return (
                <div key={i} className="rounded-lg border border-input bg-background p-3">
                  <span className="text-sm text-foreground">{text || "—"}</span>
                </div>
              );
            })}
          </div>
        );
      }
      case "review_and_submit":
        return (
          <p className="text-sm text-muted-foreground">
            Review and submit step aggregates all prior steps. See other tabs for details.
          </p>
        );
      default:
        return (
          <p className="text-sm text-muted-foreground">
            Step data for &quot;{stepKey}&quot; is not available in this view.
          </p>
        );
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">{stepLabel}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div>
          <div className={sectionHeaderClass}>{stepLabel}</div>
          <div className="mt-1.5 h-px bg-border" />
        </div>
        <div className="mt-4">{renderContent()}</div>
      </CardContent>
    </Card>
  );
}
