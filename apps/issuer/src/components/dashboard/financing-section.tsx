"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, MoreVertical, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FunnelIcon, LinkIcon } from "@heroicons/react/24/outline";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useProducts } from "@/hooks/use-products";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { cn } from "@/lib/utils";
import { getOfferStatus, type OfferStatus } from "@/lib/offer-utils";
import { ReviewOfferModal } from "@/components/review-offer-modal";
import { formatMoneyDisplay } from "@cashsouk/ui";
import type { Product } from "@cashsouk/types";
import type { IssuerDashboardContract, IssuerDashboardData, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { asContractForModal, asInvoiceForModal } from "@/types/issuer-dashboard";
import {
  getIssuerFinancingStatusPresentation,
  resolveFundingProgressPercent,
  resolveFundingStatusText,
  resolveIssuerContractDashboardBadge,
  resolveIssuerInvoiceDashboardBadge,
  type IssuerFinancingStatusKind,
} from "@/lib/issuer-dashboard-labels";

export const EM_DASH = "\u2014";

export function displayCell(value: unknown): string {
  if (value === null || value === undefined) return EM_DASH;
  const s = String(value).trim();
  if (s === "" || s === "-" || s === "NA" || s.toUpperCase() === "N/A") return EM_DASH;
  return s;
}

export function LabelValue({
  label,
  children,
  tabular,
}: {
  label: string;
  children: React.ReactNode;
  tabular?: boolean;
}) {
  return (
    <p className="text-[17px] leading-7 text-foreground">
      <span className="font-normal text-muted-foreground">{label}: </span>
      <span
        className={
          tabular
            ? "font-medium tabular-nums text-foreground"
            : "font-medium text-foreground"
        }
      >
        {children}
      </span>
    </p>
  );
}

function offerBadge(offerStatus: OfferStatus) {
  if (!offerStatus) return null;
  if (offerStatus === "Offer expired") {
    return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Offer expired</Badge>;
  }
  return (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Offer received</Badge>
  );
}

function ReviewOfferButton({ show, onClick }: { show: boolean; onClick?: () => void }) {
  if (!show) return null;
  return (
    <Button type="button" size="sm" className="h-8 rounded-md px-3 text-xs font-medium" onClick={onClick}>
      Review offer
    </Button>
  );
}

function formatMoney(value: unknown) {
  return formatMoneyDisplay(value, EM_DASH);
}

export function formatDate(value: unknown) {
  if (value === null || value === undefined) return EM_DASH;
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (typeof value === "number") d = new Date(value);
  else if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) d = new Date(Number(trimmed));
    else {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) d = new Date(parsed);
      else {
        const alt = trimmed.replace(/-/g, "/");
        const parsed2 = Date.parse(alt);
        if (!Number.isNaN(parsed2)) d = new Date(parsed2);
      }
    }
  } else {
    d = new Date(String(value));
  }
  if (!d || Number.isNaN(d.getTime())) return EM_DASH;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function IssuerFinancingStatusBadge({ kind }: { kind: IssuerFinancingStatusKind }) {
  const p = getIssuerFinancingStatusPresentation(kind);
  return (
    <Badge variant={p.variant} className={p.className}>
      {p.label}
    </Badge>
  );
}

const FUNDING_STATUS_PREFIX = "Funding status ";

/** "Funding status" stays medium; parenthetical or remainder (e.g. % funded + RM) is smaller and not bold. */
function FundingStatusLine({ text }: { text: string }) {
  const m = text.match(/^Funding status \((.+)\)$/);
  if (m) {
    return (
      <p className="text-[17px] leading-7 text-foreground">
        <span className="font-medium">{FUNDING_STATUS_PREFIX}</span>
        <span className="text-sm font-normal leading-6 text-muted-foreground">({m[1]})</span>
      </p>
    );
  }
  if (text.startsWith(FUNDING_STATUS_PREFIX)) {
    const suffix = text.slice(FUNDING_STATUS_PREFIX.length);
    return (
      <p className="text-[17px] leading-7 text-foreground">
        <span className="font-medium">{FUNDING_STATUS_PREFIX}</span>
        <span className="text-sm font-normal leading-6 text-muted-foreground">{suffix}</span>
      </p>
    );
  }
  return <p className="text-[17px] font-medium leading-7 text-foreground">{text}</p>;
}

function groupDashboardByProduct(dashboard: IssuerDashboardData) {
  const productGroups: Record<string, { contracts: IssuerDashboardContract[]; invoices: IssuerDashboardInvoice[] }> =
    {};
  for (const c of dashboard.contracts) {
    const pid = c.productId?.trim() ? c.productId : "_none";
    if (!productGroups[pid]) productGroups[pid] = { contracts: [], invoices: [] };
    productGroups[pid].contracts.push(c);
  }
  for (const inv of dashboard.invoices) {
    const pid = inv.productId?.trim() ? inv.productId : "_none";
    if (!productGroups[pid]) productGroups[pid] = { contracts: [], invoices: [] };
    productGroups[pid].invoices.push(inv);
  }
  return productGroups;
}

const FINANCING_STATUS_ORDER: IssuerFinancingStatusKind[] = [
  "draft",
  "pending_approval",
  "in_progress",
  "funded",
  "active",
  "completed",
  "unsuccessful",
];

const CONTRACT_PERIOD_PRESETS = ["all", "active", "starting_soon", "expired"] as const;
type ContractPeriodPreset = (typeof CONTRACT_PERIOD_PRESETS)[number];

const INVOICE_SUBMISSION_PRESETS = ["all", "7d", "30d", "6m"] as const;
type InvoiceSubmissionPreset = (typeof INVOICE_SUBMISSION_PRESETS)[number];

type ContractFinancingListFiltersState = {
  statusKind: IssuerFinancingStatusKind | "all";
  /** Empty = all customers; otherwise exact match on trimmed customer name. */
  customer: string;
  periodPreset: ContractPeriodPreset;
};

export type InvoiceFinancingListFiltersState = {
  statusKind: IssuerFinancingStatusKind | "all";
  customer: string;
  submissionPreset: InvoiceSubmissionPreset;
};

const DEFAULT_CONTRACT_FINANCING_LIST_FILTERS: ContractFinancingListFiltersState = {
  statusKind: "all",
  customer: "",
  periodPreset: "all",
};

export const DEFAULT_INVOICE_FINANCING_LIST_FILTERS: InvoiceFinancingListFiltersState = {
  statusKind: "all",
  customer: "",
  submissionPreset: "all",
};

type ProductListFiltersMap = Record<
  string,
  { contract: ContractFinancingListFiltersState; invoice: InvoiceFinancingListFiltersState }
>;

function getProductListFilters(map: ProductListFiltersMap, productId: string) {
  return (
    map[productId] ?? {
      contract: { ...DEFAULT_CONTRACT_FINANCING_LIST_FILTERS },
      invoice: { ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS },
    }
  );
}

/** Local calendar YYYY-MM-DD for comparisons (contract period vs today). */
function localCalendarDayKeyFromString(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (Number.isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const dt = new Date(t);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function todayLocalDayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function matchesContractPeriodPreset(row: IssuerDashboardContract, preset: ContractPeriodPreset): boolean {
  if (preset === "all") return true;
  const today = todayLocalDayKey();
  const startKey = localCalendarDayKeyFromString(row.contractStartDate);
  const endKey = localCalendarDayKeyFromString(row.contractEndDate);
  if (preset === "active") {
    if (startKey == null || endKey == null) return false;
    return startKey <= today && endKey >= today;
  }
  if (preset === "starting_soon") {
    if (startKey == null) return false;
    return startKey > today;
  }
  if (preset === "expired") {
    if (endKey == null) return false;
    return endKey < today;
  }
  return true;
}

function submissionDateMs(row: IssuerDashboardInvoice): number | null {
  if (!row.submissionDate) return null;
  const t = Date.parse(row.submissionDate);
  return Number.isNaN(t) ? null : t;
}

function matchesInvoiceSubmissionPreset(row: IssuerDashboardInvoice, preset: InvoiceSubmissionPreset): boolean {
  if (preset === "all") return true;
  const ms = submissionDateMs(row);
  if (ms == null) return false;
  const now = Date.now();
  if (preset === "7d") return ms >= now - 7 * 86400000;
  if (preset === "30d") return ms >= now - 30 * 86400000;
  if (preset === "6m") {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return ms >= cutoff.getTime();
  }
  return true;
}

function filterContracts(rows: IssuerDashboardContract[], f: ContractFinancingListFiltersState): IssuerDashboardContract[] {
  return rows.filter((row) => {
    if (f.statusKind !== "all") {
      if (resolveIssuerContractDashboardBadge(row.contractStatus) !== f.statusKind) return false;
    }
    if (f.customer) {
      const name = (row.customerName ?? "").trim();
      if (name !== f.customer) return false;
    }
    if (!matchesContractPeriodPreset(row, f.periodPreset)) return false;
    return true;
  });
}

export function filterInvoices(rows: IssuerDashboardInvoice[], f: InvoiceFinancingListFiltersState): IssuerDashboardInvoice[] {
  return rows.filter((row) => {
    if (f.statusKind !== "all") {
      if (resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus) !== f.statusKind) return false;
    }
    if (f.customer) {
      const name = (row.customerName ?? "").trim();
      if (name !== f.customer) return false;
    }
    if (!matchesInvoiceSubmissionPreset(row, f.submissionPreset)) return false;
    return true;
  });
}

function contractPeriodPresetLabel(p: ContractPeriodPreset): string {
  if (p === "all") return "All periods";
  if (p === "active") return "Active contracts";
  if (p === "starting_soon") return "Starting soon";
  return "Expired contracts";
}

function invoiceSubmissionPresetLabel(p: InvoiceSubmissionPreset): string {
  if (p === "all") return "All dates";
  if (p === "7d") return "Last 7 days";
  if (p === "30d") return "Last 30 days";
  return "Last 6 months";
}

function contractFinancingFiltersActive(f: ContractFinancingListFiltersState): boolean {
  return f.statusKind !== "all" || f.customer !== "" || f.periodPreset !== "all";
}

function invoiceFinancingFiltersActive(f: InvoiceFinancingListFiltersState): boolean {
  return f.statusKind !== "all" || f.customer !== "" || f.submissionPreset !== "all";
}

type FinancingListFilterToolbarProps =
  | {
      variant: "contract";
      rows: IssuerDashboardContract[];
      value: ContractFinancingListFiltersState;
      onChange: (next: ContractFinancingListFiltersState) => void;
      onClear: () => void;
    }
  | {
      variant: "invoice";
      rows: IssuerDashboardInvoice[];
      value: InvoiceFinancingListFiltersState;
      onChange: (next: InvoiceFinancingListFiltersState) => void;
      onClear: () => void;
      /** When true, omit Customer control (e.g. contract detail where customer is fixed). */
      hideCustomer?: boolean;
    };

function FinancingContractFilterToolbar({
  rows,
  value,
  onChange,
  onClear,
}: {
  rows: IssuerDashboardContract[];
  value: ContractFinancingListFiltersState;
  onChange: (next: ContractFinancingListFiltersState) => void;
  onClear: () => void;
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
              "h-9 max-w-[11rem] gap-1.5 truncate px-3 text-sm font-medium",
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
              "h-9 max-w-[14rem] gap-1.5 truncate px-3 text-sm font-medium",
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
              "h-9 max-w-[12rem] gap-1.5 truncate px-3 text-sm font-medium",
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

      {active ? (
        <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-sm text-muted-foreground" onClick={onClear}>
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
}: {
  rows: IssuerDashboardInvoice[];
  value: InvoiceFinancingListFiltersState;
  onChange: (next: InvoiceFinancingListFiltersState) => void;
  onClear: () => void;
  hideCustomer?: boolean;
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
    ? value.statusKind !== "all" || value.submissionPreset !== "all"
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
              "h-9 max-w-[11rem] gap-1.5 truncate px-3 text-sm font-medium",
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
              "h-9 max-w-[14rem] gap-1.5 truncate px-3 text-sm font-medium",
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
                "h-9 max-w-[12rem] gap-1.5 truncate px-3 text-sm font-medium",
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

      {active ? (
        <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-sm text-muted-foreground" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function FinancingListFilterToolbar(props: FinancingListFilterToolbarProps) {
  if (props.variant === "contract") {
    return <FinancingContractFilterToolbar rows={props.rows} value={props.value} onChange={props.onChange} onClear={props.onClear} />;
  }
  return <FinancingInvoiceFilterToolbar rows={props.rows} value={props.value} onChange={props.onChange} onClear={props.onClear} hideCustomer={props.hideCustomer} />;
}

function CollapsibleCategory({
  title,
  children,
  defaultOpen = true,
  filters,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  filters?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-lg font-semibold leading-7 tracking-tight text-foreground md:text-xl">{title}</h4>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {filters}
          <Separator orientation="vertical" className="mx-1 h-6" />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}

export function FilterButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 text-sm font-medium">
      <FunnelIcon className="h-4 w-4 shrink-0" />
      {label}
    </Button>
  );
}

export function FinancingSection({ organizationId }: { organizationId?: string }) {
  const { data: dashboard, isLoading, isError, error, refetch } = useIssuerDashboard(organizationId);
  const { data: productsData } = useProducts({ page: 1, pageSize: 100, search: "", activeOnly: true });
  const products = useMemo(() => productsData?.products ?? [], [productsData]);

  const [offerModalContext, setOfferModalContext] = useState<Parameters<typeof ReviewOfferModal>[0]["context"]>(null);
  const offerModalOpen = offerModalContext !== null;

  const [listFiltersByProduct, setListFiltersByProduct] = useState<ProductListFiltersMap>({});

  const productNameMap = useMemo(() => {
    const map = new Map<string, string>();
    type WorkflowStep = { name?: string; config?: { name?: string } };
    products.forEach((p: Product) => {
      const workflow = (p.workflow ?? []) as WorkflowStep[];
      const financingStep = workflow.find((step) => String(step?.name).toLowerCase().includes("financing type"));
      const name =
        financingStep?.config?.name ||
        workflow[0]?.config?.name ||
        (p as Product & { name?: string; title?: string }).name ||
        (p as Product & { name?: string; title?: string }).title ||
        `Product ${p.id}`;
      map.set(p.id, name);
    });
    return map;
  }, [products]);

  const productGroups = useMemo(() => (dashboard ? groupDashboardByProduct(dashboard) : {}), [dashboard]);

  type ProductOrStub = Product | { id: string; name: string };

  const productsWithData = useMemo(() => {
    const fromProducts = products.filter(
      (p: Product) =>
        (productGroups[p.id]?.contracts?.length ?? 0) + (productGroups[p.id]?.invoices?.length ?? 0) > 0
    );
    const productIdsFromProducts = new Set(fromProducts.map((p: Product) => p.id));
    const orphanIds = Object.keys(productGroups).filter(
      (pid) =>
        pid !== "_none" &&
        !productIdsFromProducts.has(pid) &&
        (productGroups[pid]?.contracts?.length ?? 0) + (productGroups[pid]?.invoices?.length ?? 0) > 0
    );
    return [
      ...fromProducts,
      ...orphanIds.map((id) => ({ id, name: productNameMap.get(id) ?? `Product ${id}` })),
    ] as ProductOrStub[];
  }, [products, productGroups, productNameMap]);

  if (!organizationId) {
    return null;
  }

  const outerCardHeader = (
    <div className="border-b border-border px-6 py-4">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">Financing</h3>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="bg-muted/50 shadow-none">
        {outerCardHeader}
        <div className="px-6 py-8 text-center text-[17px] leading-7 text-muted-foreground">
          Loading financing data…
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-muted/50 shadow-none">
        {outerCardHeader}
        <div className="px-6 py-6 space-y-3">
          <p className="font-medium text-destructive">Could not load financing</p>
          <p className="text-[17px] leading-7 text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!dashboard || productsWithData.length === 0) {
    return (
      <Card className="bg-muted/50 shadow-none">
        {outerCardHeader}
        <div className="px-6 py-8 text-center text-muted-foreground text-[17px] leading-7">
          No financing activity yet. Use{" "}
          <span className="font-medium text-foreground">Get Financed</span> to start an application.
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/50 shadow-none">
      {outerCardHeader}
      <div className="px-5 pb-5 space-y-5 md:px-6 md:pb-6">
        <ReviewOfferModal
          open={offerModalOpen}
          onOpenChange={(open) => !open && setOfferModalContext(null)}
          context={offerModalContext}
        />
        {productsWithData.map((product: ProductOrStub) => {
          const group = productGroups[product.id] ?? { contracts: [], invoices: [] };
          const productName =
            productNameMap.get(product.id) ??
            ("name" in product ? product.name : undefined) ??
            `Product ${product.id}`;

          const listFilters = getProductListFilters(listFiltersByProduct, product.id);
          const filteredContracts = filterContracts(group.contracts, listFilters.contract);
          const filteredInvoices = filterInvoices(group.invoices, listFilters.invoice);

          const patchContractFilters = (next: ContractFinancingListFiltersState) => {
            setListFiltersByProduct((prev) => ({
              ...prev,
              [product.id]: { ...getProductListFilters(prev, product.id), contract: next },
            }));
          };
          const patchInvoiceFilters = (next: InvoiceFinancingListFiltersState) => {
            setListFiltersByProduct((prev) => ({
              ...prev,
              [product.id]: { ...getProductListFilters(prev, product.id), invoice: next },
            }));
          };

          return (
            <Card key={product.id} className="rounded-xl border border-border bg-background shadow-none">
              <div className="border-b border-border px-6 py-4 md:px-8 md:pt-5">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <h3 className="text-lg font-semibold leading-7 text-foreground">{productName}</h3>
                </div>
              </div>

              <div className="space-y-6 px-6 pb-5 pt-4 md:px-8 md:pb-6">
                <CollapsibleCategory
                  title="Contract financing"
                  defaultOpen
                  filters={
                    <FinancingListFilterToolbar
                      variant="contract"
                      rows={group.contracts}
                      value={listFilters.contract}
                      onChange={patchContractFilters}
                      onClear={() =>
                        setListFiltersByProduct((prev) => ({
                          ...prev,
                          [product.id]: {
                            ...getProductListFilters(prev, product.id),
                            contract: { ...DEFAULT_CONTRACT_FINANCING_LIST_FILTERS },
                          },
                        }))
                      }
                    />
                  }
                >
                  <div className="space-y-4">
                    {group.contracts.length === 0 ? (
                      <p className="py-4 text-[17px] leading-7 text-muted-foreground">No contract financing</p>
                    ) : filteredContracts.length === 0 ? (
                      <p className="py-4 text-[17px] leading-7 text-muted-foreground">
                        No contracts match these filters.{" "}
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() =>
                            setListFiltersByProduct((prev) => ({
                              ...prev,
                              [product.id]: {
                                ...getProductListFilters(prev, product.id),
                                contract: { ...DEFAULT_CONTRACT_FINANCING_LIST_FILTERS },
                              },
                            }))
                          }
                        >
                          Clear filters
                        </button>
                      </p>
                    ) : (
                      filteredContracts.map((c) => {
                        const modalContract = asContractForModal(c.contractForModal);
                        const offerStatus = getOfferStatus(modalContract);
                        return (
                          <DashboardContractCard
                            key={c.id}
                            row={c}
                            offerStatus={offerStatus}
                            onReviewOffer={() =>
                              setOfferModalContext({
                                type: "contract",
                                applicationId: c.applicationId,
                                contract: modalContract,
                              })
                            }
                          />
                        );
                      })
                    )}
                  </div>
                </CollapsibleCategory>

                <CollapsibleCategory
                  title="Invoice financing"
                  defaultOpen
                  filters={
                    <FinancingListFilterToolbar
                      variant="invoice"
                      rows={group.invoices}
                      value={listFilters.invoice}
                      onChange={patchInvoiceFilters}
                      onClear={() =>
                        setListFiltersByProduct((prev) => ({
                          ...prev,
                          [product.id]: {
                            ...getProductListFilters(prev, product.id),
                            invoice: { ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS },
                          },
                        }))
                      }
                    />
                  }
                >
                  <div className="space-y-4">
                    {group.invoices.length === 0 ? (
                      <p className="py-4 text-[17px] leading-7 text-muted-foreground">No invoice financing</p>
                    ) : filteredInvoices.length === 0 ? (
                      <p className="py-4 text-[17px] leading-7 text-muted-foreground">
                        No invoices match these filters.{" "}
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() =>
                            setListFiltersByProduct((prev) => ({
                              ...prev,
                              [product.id]: {
                                ...getProductListFilters(prev, product.id),
                                invoice: { ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS },
                              },
                            }))
                          }
                        >
                          Clear filters
                        </button>
                      </p>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const modalInvoice = asInvoiceForModal(inv.invoiceForModal);
                        const offerStatus = getOfferStatus(modalInvoice);
                        return (
                          <DashboardInvoiceCard
                            key={inv.id}
                            row={inv}
                            offerStatus={offerStatus}
                            onReviewOffer={() =>
                              setOfferModalContext({
                                type: "invoice",
                                applicationId: inv.applicationId,
                                invoiceId: inv.id,
                                invoice: modalInvoice,
                              })
                            }
                          />
                        );
                      })
                    )}
                  </div>
                </CollapsibleCategory>
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

function DashboardContractCard({
  row,
  offerStatus,
  onReviewOffer,
}: {
  row: IssuerDashboardContract;
  offerStatus: OfferStatus;
  onReviewOffer: () => void;
}) {
  const router = useRouter();
  const actionRequiredApplicationIds = row.actionRequiredApplicationIds ?? [];
  const actionRequiredCount = actionRequiredApplicationIds.length;
  const showActionRequired = actionRequiredCount > 0;
  const actionRequiredLabel =
    actionRequiredCount === 1 ? "Action required" : `Action required (${actionRequiredCount})`;
  const approved = row.approvedFacilityAmount != null ? Number(row.approvedFacilityAmount) : 0;
  const utilised = row.utilizedFacilityAmount != null ? Number(row.utilizedFacilityAmount) : 0;
  const utilisationPct = approved > 0 ? Math.round((utilised / approved) * 100) : 0;

  const contractPeriod =
    row.contractStartDate && row.contractEndDate
      ? `${formatDate(row.contractStartDate)} to ${formatDate(row.contractEndDate)}`
      : row.contractStartDate || row.contractEndDate
        ? formatDate(row.contractStartDate ?? row.contractEndDate)
        : EM_DASH;

  return (
    <Card className="min-w-0 max-w-full rounded-xl border border-border bg-muted/50 shadow-none">
      <div className="space-y-3 px-4 py-4 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="min-w-0 max-w-full truncate leading-5">
                <span className="text-sm font-normal leading-5 text-foreground">Contract: </span>
                <span className="text-sm font-semibold leading-5 text-foreground">{displayCell(row.title)}</span>
              </p>
              <IssuerFinancingStatusBadge kind={resolveIssuerContractDashboardBadge(row.contractStatus)} />
              {offerBadge(offerStatus)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ReviewOfferButton show={offerStatus === "Offer received"} onClick={onReviewOffer} />
            {showActionRequired ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-lg border-amber-500/30 bg-amber-50 px-3 text-xs font-medium text-amber-800 hover:bg-amber-50"
                onClick={() =>
                  router.push(
                    `/applications?applicationIds=${encodeURIComponent(actionRequiredApplicationIds.join(","))}`
                  )
                }
              >
                {actionRequiredLabel}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/financing/contracts/${row.id}`}>View details</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-col gap-2 pl-3 sm:pl-4">
          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <LabelValue label="Customer">{displayCell(row.customerName)}</LabelValue>
              <LabelValue label="Contract period">{contractPeriod}</LabelValue>
              <LabelValue label="Active notes">{String(row.activeNotesCount)}</LabelValue>
            </div>
            <div className="min-w-0 w-full space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-foreground/35 dark:bg-muted shadow-sm">
                <div
                  className="h-3 rounded-full bg-foreground"
                  style={{ width: `${Math.min(100, Math.max(0, utilisationPct))}%` }}
                />
              </div>
              <div className="flex justify-between gap-6 sm:gap-8">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold tabular-nums leading-7 text-foreground">
                    {formatMoney(utilised)}
                  </p>
                  <p className="text-sm font-normal leading-6 text-muted-foreground">(Utilised facility)</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[17px] font-semibold tabular-nums leading-7 text-foreground">
                    {formatMoney(approved)}
                  </p>
                  <p className="text-sm font-normal leading-6 text-muted-foreground">(Approved facility)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DashboardInvoiceCard({
  row,
  offerStatus,
  onReviewOffer,
}: {
  row: IssuerDashboardInvoice;
  offerStatus: OfferStatus;
  onReviewOffer: () => void;
}) {
  const router = useRouter();
  const actionRequiredApplicationIds = row.actionRequiredApplicationIds ?? [];
  const actionRequiredCount = actionRequiredApplicationIds.length;
  const showActionRequired = actionRequiredCount > 0;
  const actionRequiredLabel =
    actionRequiredCount === 1 ? "Action required" : `Action required (${actionRequiredCount})`;
  const badgeKind = resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus);
  const progress = resolveFundingProgressPercent(row.note);
  const fundingLabel = resolveFundingStatusText(row.note);
  const noteRef = displayCell(row.note?.noteReference);
  const invDetails = asInvoiceForModal(row.invoiceForModal)?.details;
  const maturityRaw = invDetails?.maturity_date ?? row.note?.maturityDate ?? null;

  return (
    <Card className="min-w-0 max-w-full rounded-xl border border-border bg-muted/50 shadow-none">
      <div className="space-y-3 px-4 py-4 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="min-w-0 max-w-full truncate leading-5">
                <span className="text-sm font-normal leading-5 text-foreground">Invoice no: </span>
                <span className="text-sm font-semibold leading-5 text-foreground">
                  {displayCell(row.invoiceNumber)}
                </span>
              </p>
              <IssuerFinancingStatusBadge kind={badgeKind} />
              {offerBadge(offerStatus)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ReviewOfferButton show={offerStatus === "Offer received"} onClick={onReviewOffer} />
            {showActionRequired ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-lg border-amber-500/30 bg-amber-50 px-3 text-xs font-medium text-amber-800 hover:bg-amber-50"
                onClick={() =>
                  router.push(
                    `/applications?applicationIds=${encodeURIComponent(actionRequiredApplicationIds.join(","))}`
                  )
                }
              >
                {actionRequiredLabel}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 pl-3 sm:pl-4">
          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <p className="text-[17px] leading-7 text-foreground">
                <span className="font-normal text-muted-foreground">Note no: </span>
                {row.note?.id && noteRef !== EM_DASH ? (
                  <Link
                    href={`/notes/${row.note.id}`}
                    className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <span className="min-w-0 truncate">{noteRef}</span>
                    <LinkIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{noteRef}</span>
                )}
              </p>
              <LabelValue label="Customer">{displayCell(row.customerName)}</LabelValue>
            </div>
            <div className="min-w-0 space-y-2">
              <LabelValue label="Submission date">{formatDate(row.submissionDate)}</LabelValue>
              <LabelValue label="Funding deadline">
                {row.note?.fundingDeadline ? formatDate(row.note.fundingDeadline) : EM_DASH}
              </LabelValue>
              <LabelValue label="Maturity date">{formatDate(maturityRaw)}</LabelValue>
            </div>
          </div>

          <div className="grid grid-cols-1 items-end gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <LabelValue label="Invoice value" tabular>
                {formatMoney(row.invoiceValue)}
              </LabelValue>
              <LabelValue label="Financing amount" tabular>
                {formatMoney(row.financingAmount)}
              </LabelValue>
            </div>
            <div className="min-w-0 w-full space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-foreground/35 dark:bg-muted shadow-sm">
                <div
                  className="h-3 rounded-full bg-foreground"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <FundingStatusLine text={fundingLabel} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
