"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import { ListToolbarFilterTrigger } from "@cashsouk/ui";
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

function SelectedMark({ selected }: { selected: boolean }) {
  return selected ? <CheckIcon className="h-4 w-4 shrink-0 text-foreground" /> : null;
}

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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ListToolbarFilterTrigger label="Product" count={value !== "" ? 1 : 0} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[min(24rem,70vh)] overflow-y-auto">
        <DropdownMenuItem
          onClick={() => onChange("")}
          className="flex items-center justify-between gap-2"
        >
          All products
          <SelectedMark selected={value === ""} />
        </DropdownMenuItem>
        {productOptions.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => onChange(p.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0 truncate">{p.name}</span>
            <SelectedMark selected={value === p.id} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-11 rounded-xl px-3 text-muted-foreground"
      onClick={onClick}
    >
      Clear
    </Button>
  );
}

export function FinancingContractFilterToolbar({
  rows,
  value,
  onChange,
  onClear,
  productOptions,
  showClearButton = true,
}: {
  rows: IssuerDashboardContract[];
  value: ContractFinancingListFiltersState;
  onChange: (next: ContractFinancingListFiltersState) => void;
  onClear: () => void;
  productOptions?: FinancingProductOption[];
  showClearButton?: boolean;
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
  const active = contractFinancingFiltersActive(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger
            label="Status"
            count={value.statusKind !== "all" ? 1 : 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => onChange({ ...value, statusKind: "all" })}
            className="flex items-center justify-between gap-2"
          >
            All statuses
            <SelectedMark selected={value.statusKind === "all"} />
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
                <SelectedMark selected={value.statusKind === kind} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger
            label="Period"
            count={value.periodPreset !== "all" ? 1 : 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {CONTRACT_PERIOD_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => onChange({ ...value, periodPreset: preset })}
              className="flex items-center justify-between gap-2"
            >
              <span>{contractPeriodPresetLabel(preset)}</span>
              <SelectedMark selected={value.periodPreset === preset} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger
            label="Customer"
            count={value.customer !== "" ? 1 : 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-[min(24rem,70vh)] overflow-y-auto">
          <DropdownMenuItem
            onClick={() => onChange({ ...value, customer: "" })}
            className="flex items-center justify-between gap-2"
          >
            All customers
            <SelectedMark selected={value.customer === ""} />
          </DropdownMenuItem>
          {customerList.map((name) => (
            <DropdownMenuItem
              key={name}
              onClick={() => onChange({ ...value, customer: name })}
              className="flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate">{name}</span>
              <SelectedMark selected={value.customer === name} />
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

      {active && showClearButton ? <ClearFiltersButton onClick={onClear} /> : null}
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
  showClearButton = true,
}: {
  rows: IssuerDashboardInvoice[];
  value: InvoiceFinancingListFiltersState;
  onChange: (next: InvoiceFinancingListFiltersState) => void;
  onClear: () => void;
  hideCustomer?: boolean;
  productOptions?: FinancingProductOption[];
  showClearButton?: boolean;
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
  const active = hideCustomer
    ? value.statusKind !== "all" || value.submissionPreset !== "all" || value.productId !== ""
    : invoiceFinancingFiltersActive(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger
            label="Status"
            count={value.statusKind !== "all" ? 1 : 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => onChange({ ...value, statusKind: "all" })}
            className="flex items-center justify-between gap-2"
          >
            All statuses
            <SelectedMark selected={value.statusKind === "all"} />
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
                <SelectedMark selected={value.statusKind === kind} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger
            label="Submitted in"
            count={value.submissionPreset !== "all" ? 1 : 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {INVOICE_SUBMISSION_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => onChange({ ...value, submissionPreset: preset })}
              className="flex items-center justify-between gap-2"
            >
              <span>{invoiceSubmissionPresetLabel(preset)}</span>
              <SelectedMark selected={value.submissionPreset === preset} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {!hideCustomer ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ListToolbarFilterTrigger
              label="Customer"
              count={value.customer !== "" ? 1 : 0}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-[min(24rem,70vh)] overflow-y-auto">
            <DropdownMenuItem
              onClick={() => onChange({ ...value, customer: "" })}
              className="flex items-center justify-between gap-2"
            >
              All customers
              <SelectedMark selected={value.customer === ""} />
            </DropdownMenuItem>
            {customerList.map((name) => (
              <DropdownMenuItem
                key={name}
                onClick={() => onChange({ ...value, customer: name })}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate">{name}</span>
                <SelectedMark selected={value.customer === name} />
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

      {active && showClearButton ? <ClearFiltersButton onClick={onClear} /> : null}
    </div>
  );
}
