"use client";

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

export function FacilityAttentionCard({ row }: { row: IssuerDashboardContract }) {
  const action = getFacilityAttentionAction(row);

  return (
    <FinancingAttentionCardLayout
      surfaceClassName={FINANCING_ATTENTION_SURFACE}
      kind="facility"
      badge={
        <IssuerFinancingStatusBadge kind={resolveIssuerContractDashboardBadge(row.contractStatus)} />
      }
      headline={action.headline}
      customer={displayCell(row.customerName)}
      amount={formatMoney(facilityAttentionAmountValue(row))}
      meta={facilityAttentionMeta(row)}
      detail={facilityAttentionDetail(row)}
      hint={action.hint}
      ctaHref={action.href}
      ctaLabel={action.label}
      ctaVariant={action.buttonVariant}
    />
  );
}
