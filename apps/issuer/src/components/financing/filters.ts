import type { IssuerDashboardContract, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import {
  resolveIssuerContractDashboardBadge,
  resolveIssuerInvoiceDashboardBadge,
  type IssuerFinancingStatusKind,
} from "@/lib/issuer-dashboard-labels";

export const FINANCING_STATUS_ORDER: IssuerFinancingStatusKind[] = [
  "draft",
  "pending_approval",
  "in_progress",
  "funded",
  "active",
  "completed",
  "unsuccessful",
];

export const CONTRACT_PERIOD_PRESETS = ["all", "active", "starting_soon", "expired"] as const;
export type ContractPeriodPreset = (typeof CONTRACT_PERIOD_PRESETS)[number];

export const INVOICE_SUBMISSION_PRESETS = ["all", "7d", "30d", "6m"] as const;
export type InvoiceSubmissionPreset = (typeof INVOICE_SUBMISSION_PRESETS)[number];

export type ContractFinancingListFiltersState = {
  statusKind: IssuerFinancingStatusKind | "all";
  /** Empty = all customers; otherwise exact match on trimmed customer name. */
  customer: string;
  periodPreset: ContractPeriodPreset;
  /** Empty = all products; otherwise exact match on productId. */
  productId: string;
};

export type InvoiceFinancingListFiltersState = {
  statusKind: IssuerFinancingStatusKind | "all";
  customer: string;
  submissionPreset: InvoiceSubmissionPreset;
  productId: string;
};

export const DEFAULT_CONTRACT_FINANCING_LIST_FILTERS: ContractFinancingListFiltersState = {
  statusKind: "all",
  customer: "",
  periodPreset: "all",
  productId: "",
};

export const DEFAULT_INVOICE_FINANCING_LIST_FILTERS: InvoiceFinancingListFiltersState = {
  statusKind: "all",
  customer: "",
  submissionPreset: "all",
  productId: "",
};

export function contractPeriodPresetLabel(p: ContractPeriodPreset): string {
  if (p === "all") return "All periods";
  if (p === "active") return "Active contracts";
  if (p === "starting_soon") return "Starting soon";
  return "Expired contracts";
}

export function invoiceSubmissionPresetLabel(p: InvoiceSubmissionPreset): string {
  if (p === "all") return "All dates";
  if (p === "7d") return "Last 7 days";
  if (p === "30d") return "Last 30 days";
  return "Last 6 months";
}

export function contractFinancingFiltersActive(f: ContractFinancingListFiltersState): boolean {
  return f.statusKind !== "all" || f.customer !== "" || f.periodPreset !== "all" || f.productId !== "";
}

export function invoiceFinancingFiltersActive(f: InvoiceFinancingListFiltersState): boolean {
  return f.statusKind !== "all" || f.customer !== "" || f.submissionPreset !== "all" || f.productId !== "";
}

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

export function matchesContractPeriodPreset(row: IssuerDashboardContract, preset: ContractPeriodPreset): boolean {
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

export function matchesInvoiceSubmissionPreset(row: IssuerDashboardInvoice, preset: InvoiceSubmissionPreset): boolean {
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

export function filterContracts(
  rows: IssuerDashboardContract[],
  f: ContractFinancingListFiltersState
): IssuerDashboardContract[] {
  return rows.filter((row) => {
    if (f.statusKind !== "all") {
      if (resolveIssuerContractDashboardBadge(row.contractStatus) !== f.statusKind) return false;
    }
    if (f.customer) {
      const name = (row.customerName ?? "").trim();
      if (name !== f.customer) return false;
    }
    if (f.productId && (row.productId ?? "") !== f.productId) return false;
    if (!matchesContractPeriodPreset(row, f.periodPreset)) return false;
    return true;
  });
}

export function filterInvoices(
  rows: IssuerDashboardInvoice[],
  f: InvoiceFinancingListFiltersState
): IssuerDashboardInvoice[] {
  return rows.filter((row) => {
    if (f.statusKind !== "all") {
      if (resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus) !== f.statusKind) return false;
    }
    if (f.customer) {
      const name = (row.customerName ?? "").trim();
      if (name !== f.customer) return false;
    }
    if (f.productId && (row.productId ?? "") !== f.productId) return false;
    if (!matchesInvoiceSubmissionPreset(row, f.submissionPreset)) return false;
    return true;
  });
}
