import {
  resolveIssuerContractDashboardBadge,
  resolveIssuerInvoiceDashboardBadge,
} from "@/lib/issuer-dashboard-labels";
import type { IssuerDashboardContract } from "@/types/issuer-dashboard";
import {
  dashboardNoteFromListItem,
  type FinancingInvoiceRow,
} from "./financing-invoice-rows";

export function isActiveFacility(row: IssuerDashboardContract): boolean {
  return resolveIssuerContractDashboardBadge(row.contractStatus) === "active";
}

export function partitionByPredicate<T>(
  items: readonly T[],
  matches: (item: T) => boolean
): { matched: T[]; rest: T[] } {
  const matched: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (matches(item)) matched.push(item);
    else rest.push(item);
  }
  return { matched, rest };
}

export function financingInvoiceRowStatusKind(row: FinancingInvoiceRow) {
  if (row.kind === "invoice") {
    return resolveIssuerInvoiceDashboardBadge(row.invoice.note, row.invoice.invoiceStatus);
  }
  return resolveIssuerInvoiceDashboardBadge(dashboardNoteFromListItem(row.note), "");
}

function invoiceRowIsListed(row: FinancingInvoiceRow): boolean {
  return row.kind === "note" || row.invoice.note != null;
}

/** List sections under the invoice toolbar: Active → Funded → Funding now → other. */
export function partitionInvoiceListRows(rows: readonly FinancingInvoiceRow[]): {
  active: FinancingInvoiceRow[];
  funded: FinancingInvoiceRow[];
  fundingNow: FinancingInvoiceRow[];
  other: FinancingInvoiceRow[];
} {
  const active: FinancingInvoiceRow[] = [];
  const funded: FinancingInvoiceRow[] = [];
  const fundingNow: FinancingInvoiceRow[] = [];
  const other: FinancingInvoiceRow[] = [];
  for (const row of rows) {
    const kind = financingInvoiceRowStatusKind(row);
    if (kind === "active") active.push(row);
    else if (kind === "funded") funded.push(row);
    else if (kind === "in_progress" && invoiceRowIsListed(row)) fundingNow.push(row);
    else other.push(row);
  }
  return { active, funded, fundingNow, other };
}
