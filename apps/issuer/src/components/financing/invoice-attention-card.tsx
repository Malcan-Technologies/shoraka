"use client";

import { ProductCatalogName } from "@cashsouk/ui";
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
import { FacilityTiedLink } from "./facility-tied-link";
import { resolveIssuerFacilityLink } from "./facility-tied";

export function InvoiceAttentionCard({
  row,
  facilityDisplayReference,
  productName,
  productImageS3Key,
}: {
  row: IssuerDashboardInvoice;
  facilityDisplayReference?: string | null;
  productName?: string | null;
  productImageS3Key?: string | null;
}) {
  const action = getInvoiceAttentionAction(row);
  const badgeKind = resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus);
  const facilityLink = resolveIssuerFacilityLink({
    contractId: row.contractId,
    displayReference: facilityDisplayReference,
  });

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
      product={
        (productName ?? row.productName)?.trim() ? (
          <ProductCatalogName
            name={productName ?? row.productName}
            imageS3Key={productImageS3Key}
            size="xs"
          />
        ) : null
      }
      related={
        facilityLink ? (
          <FacilityTiedLink
            contractId={row.contractId}
            displayReference={facilityDisplayReference}
          />
        ) : null
      }
      ctaHref={action.href}
      ctaLabel={action.label}
      ctaVariant={action.buttonVariant}
    />
  );
}
