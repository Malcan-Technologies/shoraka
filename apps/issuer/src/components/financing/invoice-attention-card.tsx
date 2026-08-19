"use client";

import type { IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { resolveIssuerInvoiceDashboardBadge } from "@/lib/issuer-dashboard-labels";
import {
  FINANCING_ATTENTION_SURFACE,
  IssuerFinancingStatusBadge,
  displayCell,
  formatMoney,
} from "./utils";
import { FinancingAttentionCardLayout } from "./financing-attention-card-layout";
import {
  getInvoiceAttentionAction,
  invoiceAttentionDetail,
  invoiceAttentionMeta,
  resolveInvoiceAttentionFinancedPercent,
} from "./invoice-attention-card-model";

export function InvoiceAttentionCard({ row }: { row: IssuerDashboardInvoice }) {
  const action = getInvoiceAttentionAction(row);
  const badgeKind = resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus);

  return (
    <FinancingAttentionCardLayout
      surfaceClassName={FINANCING_ATTENTION_SURFACE}
      kind="invoice"
      badge={<IssuerFinancingStatusBadge kind={badgeKind} />}
      headline={action.headline}
      customer={displayCell(row.customerName)}
      amount={formatMoney(row.financingAmount ?? row.invoiceValue)}
      meta={invoiceAttentionMeta(row)}
      detail={invoiceAttentionDetail(row, resolveInvoiceAttentionFinancedPercent(row))}
      hint={action.hint}
      ctaHref={action.href}
      ctaLabel={action.label}
      ctaVariant={action.buttonVariant}
    />
  );
}
