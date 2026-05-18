"use client";

import { Check } from "lucide-react";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getIssuerFinancingStatusPresentation,
  resolveIssuerContractDashboardBadge,
  resolveIssuerInvoiceDashboardBadge,
  type IssuerFinancingStatusKind,
} from "@/lib/issuer-dashboard-labels";
import { cn } from "@/lib/utils";
import type { IssuerDashboardContract, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import {
  CONTRACT_PERIOD_PRESETS,
  FINANCING_STATUS_ORDER,
  INVOICE_SUBMISSION_PRESETS,
  contractFinancingFiltersActive,
  contractPeriodPresetLabel,
  invoiceFinancingFiltersActive,
  invoiceSubmissionPresetLabel,
  type ContractFinancingListFiltersState,
  type InvoiceFinancingListFiltersState,
} from "./filters";

export type FinancingProductOption = { id: string; name: string };

function ProductFilterDropdown({
  productOptions,
  value,
  onChange,
}: {
  productOptions: FinancingProductOption[];
  value: string;
  onChange: (next: string) => void;
}) {
  if (productOptions.length <= 1) return null;
  const current = productOptions.find((p) => p.id === value);
  const trigger = value === "" ? "Product" : `Product: ${current?.name ?? value}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 max-w-[14rem] gap-1.5 truncate px-3 text-sm font-medium transition-none focus-visible:ring-0 focus-visible:ring-offset-0",
            value !== "" && "border-primary/40 bg-muted/50"
          )}
        >
          <FunnelIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{trigger}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[min(24rem,70vh)] overflow-y-auto">
        <DropdownMenuItem
          onClick={() => onChange("")}
          className="flex items-center justify-between gap-2"
        >
          All products
          {value === "" ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
        </DropdownMenuItem>
        {productOptions.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => onChange(p.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0 truncate">{p.name}</span>
            {value === p.id ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FinancingContractFilterToolbar({
  rows,
  value,
  onChange,
  onClear,
  productOptions,
}: {
  rows: IssuerDashboardContract[];
  value: ContractFinancingListFiltersState;
  onChange: (next: ContractFinancingListFiltersState) => void;
  onClear: () => void;
  productOptions?: FinancingProductOption[];
}) {
  const kindsPresent = new Set<IssuerFinancingStatusKind>();
  for (const r of rows) {
    kindsPresent.add(resolveIssuerContractDashboardBadge(r.contractStatus));
  }
  const statusOptions = FINANCING_STATUS_ORDER.filter((k) => kindsPresent.has(k));

  const customers = new Set<string>();
  for (const r of rows) {
    const t = (r.customerName ?? "").trim();
    if (t) customers.add(t);
  }
  const customerList = [...customers].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const statusTrigger =
    value.statusKind === "all" ? "Status" : `Status: ${getIssuerFinancingStatusPresentation(value.statusKind).label}`;
  const customerTrigger = value.customer === "" ? "Customer" : `Customer: ${value.customer}`;
  const periodTrigger =
    value.periodPreset === "all" ? "Period" : `Period: ${contractPeriodPresetLabel(value.periodPreset)}`;
  const active = contractFinancingFiltersActive(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 max-w-[11rem] gap-1.5 truncate px-3 text-sm font-medium transition-none focus-visible:ring-0 focus-visible:ring-offset-0",
              value.statusKind !== "all" && "border-primary/40 bg-muted/50"
            )}
          >
            <FunnelIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{statusTrigger}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem
            onClick={() => onChange({ ...value, statusKind: "all" })}
            className="flex items-center justify-between gap-2"
          >
            All statuses
            {value.statusKind === "all" ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
          </DropdownMenuItem>
          {statusOptions.map((kind) => {
            const p = getIssuerFinancingStatusPresentation(kind);
            return (
              <DropdownMenuItem
                key={kind}
                onClick={() => onChange({ ...value, statusKind: kind })}
                className="flex items-center justify-between gap-2"
              >
                <span>{p.label}</span>
                {value.statusKind === kind ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 max-w-[14rem] gap-1.5 truncate px-3 text-sm font-medium transition-none focus-visible:ring-0 focus-visible:ring-offset-0",
              value.periodPreset !== "all" && "border-primary/40 bg-muted/50"
            )}
          >
            <FunnelIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{periodTrigger}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {CONTRACT_PERIOD_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => onChange({ ...value, periodPreset: preset })}
              className="flex items-center justify-between gap-2"
            >
              <span>{contractPeriodPresetLabel(preset)}</span>
              {value.periodPreset === preset ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 max-w-[12rem] gap-1.5 truncate px-3 text-sm font-medium transition-none focus-visible:ring-0 focus-visible:ring-offset-0",
              value.customer !== "" && "border-primary/40 bg-muted/50"
            )}
          >
            <FunnelIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{customerTrigger}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-[min(24rem,70vh)] overflow-y-auto">
          <DropdownMenuItem
            onClick={() => onChange({ ...value, customer: "" })}
            className="flex items-center justify-between gap-2"
          >
            All customers
            {value.customer === "" ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
          </DropdownMenuItem>
          {customerList.map((name) => (
            <DropdownMenuItem
              key={name}
              onClick={() => onChange({ ...value, customer: name })}
              className="flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate">{name}</span>
              {value.customer === name ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {productOptions ? (
        <ProductFilterDropdown
          productOptions={productOptions}
          value={value.productId}
          onChange={(productId) => onChange({ ...value, productId })}
        />
      ) : null}

      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-sm text-muted-foreground transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={onClear}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}

export function FinancingInvoiceFilterToolbar({
  rows,
  value,
  onChange,
  onClear,
  hideCustomer = false,
  productOptions,
}: {
  rows: IssuerDashboardInvoice[];
  value: InvoiceFinancingListFiltersState;
  onChange: (next: InvoiceFinancingListFiltersState) => void;
  onClear: () => void;
  /** When true, omit Customer control (e.g. contract detail where customer is fixed). */
  hideCustomer?: boolean;
  productOptions?: FinancingProductOption[];
}) {
  const kindsPresent = new Set<IssuerFinancingStatusKind>();
  for (const r of rows) {
    kindsPresent.add(resolveIssuerInvoiceDashboardBadge(r.note, r.invoiceStatus));
  }
  const statusOptions = FINANCING_STATUS_ORDER.filter((k) => kindsPresent.has(k));

  const customers = new Set<string>();
  if (!hideCustomer) {
    for (const r of rows) {
      const t = (r.customerName ?? "").trim();
      if (t) customers.add(t);
    }
  }
  const customerList = [...customers].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const statusTrigger =
    value.statusKind === "all" ? "Status" : `Status: ${getIssuerFinancingStatusPresentation(value.statusKind).label}`;
  const customerTrigger = value.customer === "" ? "Customer" : `Customer: ${value.customer}`;
  const submissionTrigger =
    value.submissionPreset === "all"
      ? "Submission date"
      : `Submission date: ${invoiceSubmissionPresetLabel(value.submissionPreset)}`;
  const active = hideCustomer
    ? value.statusKind !== "all" || value.submissionPreset !== "all" || value.productId !== ""
    : invoiceFinancingFiltersActive(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 max-w-[11rem] gap-1.5 truncate px-3 text-sm font-medium transition-none focus-visible:ring-0 focus-visible:ring-offset-0",
              value.statusKind !== "all" && "border-primary/40 bg-muted/50"
            )}
          >
            <FunnelIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{statusTrigger}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem
            onClick={() => onChange({ ...value, statusKind: "all" })}
            className="flex items-center justify-between gap-2"
          >
            All statuses
            {value.statusKind === "all" ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
          </DropdownMenuItem>
          {statusOptions.map((kind) => {
            const p = getIssuerFinancingStatusPresentation(kind);
            return (
              <DropdownMenuItem
                key={kind}
                onClick={() => onChange({ ...value, statusKind: kind })}
                className="flex items-center justify-between gap-2"
              >
                <span>{p.label}</span>
                {value.statusKind === kind ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 max-w-[14rem] gap-1.5 truncate px-3 text-sm font-medium transition-none focus-visible:ring-0 focus-visible:ring-offset-0",
              value.submissionPreset !== "all" && "border-primary/40 bg-muted/50"
            )}
          >
            <FunnelIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{submissionTrigger}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {INVOICE_SUBMISSION_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => onChange({ ...value, submissionPreset: preset })}
              className="flex items-center justify-between gap-2"
            >
              <span>{invoiceSubmissionPresetLabel(preset)}</span>
              {value.submissionPreset === preset ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {!hideCustomer ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 max-w-[12rem] gap-1.5 truncate px-3 text-sm font-medium transition-none focus-visible:ring-0 focus-visible:ring-offset-0",
                value.customer !== "" && "border-primary/40 bg-muted/50"
              )}
            >
              <FunnelIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{customerTrigger}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-[min(24rem,70vh)] overflow-y-auto">
            <DropdownMenuItem
              onClick={() => onChange({ ...value, customer: "" })}
              className="flex items-center justify-between gap-2"
            >
              All customers
              {value.customer === "" ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
            </DropdownMenuItem>
            {customerList.map((name) => (
              <DropdownMenuItem
                key={name}
                onClick={() => onChange({ ...value, customer: name })}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate">{name}</span>
                {value.customer === name ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {productOptions ? (
        <ProductFilterDropdown
          productOptions={productOptions}
          value={value.productId}
          onChange={(productId) => onChange({ ...value, productId })}
        />
      ) : null}

      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-sm text-muted-foreground transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={onClear}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}
