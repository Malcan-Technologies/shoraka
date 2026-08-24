"use client";

import { ProductCatalogName } from "@cashsouk/ui";
import type { IssuerDashboardContract } from "@/types/issuer-dashboard";
import { resolveIssuerContractDashboardBadge } from "@/lib/issuer-dashboard-labels";
import {
  FINANCING_ATTENTION_SURFACE,
  IssuerFinancingStatusBadge,
  displayCell,
  formatMoney,
} from "./utils";
import { FinancingAttentionCardLayout } from "./financing-attention-card-layout";
import {
  facilityAttentionAmountValue,
  facilityAttentionDetail,
  facilityAttentionMeta,
  getFacilityAttentionAction,
} from "./facility-attention-card-model";

export function FacilityAttentionCard({
  row,
  productName,
  productImageS3Key,
}: {
  row: IssuerDashboardContract;
  productName?: string | null;
  productImageS3Key?: string | null;
}) {
  const action = getFacilityAttentionAction(row);

  return (
    <FinancingAttentionCardLayout
      surfaceClassName={FINANCING_ATTENTION_SURFACE}
      kind="facility"
      badge={
        <IssuerFinancingStatusBadge
          kind={resolveIssuerContractDashboardBadge(row.contractStatus, {
            facilityFeeUpfrontOutstanding: row.facilityFeeUpfrontOutstanding,
          })}
        />
      }
      headline={action.headline}
      customer={displayCell(row.customerName)}
      amount={formatMoney(facilityAttentionAmountValue(row))}
      meta={facilityAttentionMeta(row)}
      detail={facilityAttentionDetail(row)}
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
      ctaHref={action.href}
      ctaLabel={action.label}
      ctaVariant={action.buttonVariant}
    />
  );
}
