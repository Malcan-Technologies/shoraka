import type { ReactNode } from "react";
import { formatCurrency } from "@cashsouk/config";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import {
  formatFinancingTenureFromDisbursement,
  INVOICE_OFFER_INDICATIVE_PAYABLE_TOOLTIP,
  INVOICE_OFFER_INDICATIVE_PROFIT_TOOLTIP,
} from "@cashsouk/types";
import type { InvoiceFeeDisplay } from "@/lib/facility-fee-display";
import { buildInvoiceOfferMoneyRows } from "./invoice-offer-money-rows";
import {
  OfferTermsDlColumn,
  OfferTermsDlRow,
  OfferTermsKpiGrid,
  type OfferTermsKpiTile,
} from "./offer-terms-layout";

export const INVOICE_OFFER_PLATFORM_FEE_TOOLTIP =
  "Deducted from disbursement when funding closes, as a percentage of the funded amount. The amount shown is estimated from the offered amount; the final fee uses actual funded.";

export const INVOICE_OFFER_PROFIT_RATE_TOOLTIP =
  "Profit per annum (%). Deducted during settlement when calculating the residual refund to the issuer.";

export const INVOICE_OFFER_FACILITY_FEE_SCHEDULE_TOOLTIP =
  "This invoice collects the exact facility-fee amount shown. The facility fee is owed in full when the facility offer is accepted; CashSouk collects it at its discretion.";

export const INVOICE_OFFER_FACILITY_FEE_GRANDFATHER_TOOLTIP =
  "Deducted from disbursement when funding closes. For facility financing, this is collected progressively until the facility fee cap is reached.";

export const INVOICE_OFFER_NET_DISBURSEMENT_TOOLTIP =
  "Approved financing minus drawdown fee, facility fee, and any extra fees. Estimated at full funding; the final net uses actual funded.";

export function invoiceOfferFacilityFeeTooltip(feeDisplay: InvoiceFeeDisplay): string {
  if (feeDisplay.facilityFeeCollectionWaived) {
    return feeDisplay.waiverReason
      ? `Facility fee collection for this drawdown has been waived: ${feeDisplay.waiverReason}`
      : "Facility fee collection for this drawdown has been waived.";
  }
  if (feeDisplay.contractFacilityFeeWaived) {
    return "The facility fee for this facility has been waived.";
  }
  if (feeDisplay.mode === "schedule") {
    if (feeDisplay.facilityFeeFullyCollected && (feeDisplay.facilityFeeAmount ?? 0) === 0) {
      return `${INVOICE_OFFER_FACILITY_FEE_SCHEDULE_TOOLTIP} No facility fee applies here because none remains to collect.`;
    }
    return INVOICE_OFFER_FACILITY_FEE_SCHEDULE_TOOLTIP;
  }
  if (feeDisplay.facilityFeeFullyCollected) {
    return `${INVOICE_OFFER_FACILITY_FEE_GRANDFATHER_TOOLTIP} No facility fee applies here because the cap has already been reached.`;
  }
  return INVOICE_OFFER_FACILITY_FEE_GRANDFATHER_TOOLTIP;
}

function formatMoneyCell(amount: number | null, kind: "base" | "deduction" | "net"): string {
  if (amount == null) return "—";
  const formatted = formatCurrency(amount);
  return kind === "deduction" ? `− ${formatted}` : formatted;
}

export function InvoiceOfferTerms({
  invoiceNumber,
  invoiceValue,
  maturityDate,
  financingTenureDays,
  profitRate,
  riskRating,
  financingMarginPercent,
  indicativeProfit,
  indicativeAmountPayable,
  requestedFinancing,
  approvedFinancing,
  includeFacilityFee,
  feeDisplay,
  footer,
  aside,
  meta,
}: {
  invoiceNumber: string;
  invoiceValue: number | null;
  maturityDate: string | null;
  financingTenureDays: number | null;
  profitRate: string;
  riskRating?: string | null;
  financingMarginPercent?: number | null;
  indicativeProfit?: number | null;
  indicativeAmountPayable?: number | null;
  requestedFinancing: number | null;
  approvedFinancing: number | null;
  includeFacilityFee: boolean;
  feeDisplay: InvoiceFeeDisplay;
  footer?: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode;
}) {
  const rows = buildInvoiceOfferMoneyRows({
    requestedFinancing,
    approvedFinancing,
    includeFacilityFee,
    feeDisplay,
  });
  const feeRows = rows.filter((row) => row.key !== "requested" && row.key !== "approved");

  const kpis: OfferTermsKpiTile[] = [];
  if (approvedFinancing != null) {
    kpis.push({
      key: "approved",
      label: "Approved financing",
      value: formatCurrency(approvedFinancing),
      hint:
        requestedFinancing != null ? `Requested ${formatCurrency(requestedFinancing)}` : undefined,
    });
  }
  kpis.push({
    key: "profit",
    label: "Profit rate",
    value: (
      <span className="inline-flex items-center gap-1">
        {profitRate}
        <InfoTooltip content={INVOICE_OFFER_PROFIT_RATE_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
      </span>
    ),
    hint: "per annum",
  });
  if (financingTenureDays != null) {
    kpis.push({
      key: "tenure",
      label: "Financing tenure",
      value: formatFinancingTenureFromDisbursement(financingTenureDays),
      hint: maturityDate ? `Matures ${maturityDate}` : undefined,
    });
  }
  if (indicativeProfit != null) {
    kpis.push({
      key: "profit-amount",
      label: "Indicative profit",
      value: (
        <span className="inline-flex items-center gap-1">
          {formatCurrency(indicativeProfit)}
          <InfoTooltip
            content={INVOICE_OFFER_INDICATIVE_PROFIT_TOOLTIP}
            iconClassName="h-3.5 w-3.5 shrink-0"
          />
        </span>
      ),
      hint: "Estimate, not final",
    });
  }
  if (indicativeAmountPayable != null) {
    kpis.push({
      key: "payable",
      label: "Payable at maturity",
      value: (
        <span className="inline-flex items-center gap-1">
          {formatCurrency(indicativeAmountPayable)}
          <InfoTooltip
            content={INVOICE_OFFER_INDICATIVE_PAYABLE_TOOLTIP}
            iconClassName="h-3.5 w-3.5 shrink-0"
          />
        </span>
      ),
      hint: "Financing + profit",
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h3 className="text-card-title font-semibold">Offer terms</h3>
        {meta ? <span className="text-meta text-muted-foreground">{meta}</span> : null}
      </div>
      <OfferTermsKpiGrid tiles={kpis} />
      <div className="mt-5 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(14.5rem,1fr))]">
        <OfferTermsDlColumn title="Invoice">
          <OfferTermsDlRow label="Invoice number" value={invoiceNumber} />
          <OfferTermsDlRow
            label="Invoice value"
            value={invoiceValue != null ? formatCurrency(invoiceValue) : "—"}
          />
          {maturityDate ? <OfferTermsDlRow label="Invoice due date" value={maturityDate} /> : null}
          {financingMarginPercent != null && Number.isFinite(financingMarginPercent) ? (
            <OfferTermsDlRow label="Financing margin" value={`${financingMarginPercent}%`} />
          ) : null}
          {riskRating ? <OfferTermsDlRow label="Risk rating" value={riskRating} /> : null}
        </OfferTermsDlColumn>
        <OfferTermsDlColumn title="Fees">
          {feeRows.map((row) => {
            const tooltip =
              row.key === "platform" ? (
                <InfoTooltip
                  content={INVOICE_OFFER_PLATFORM_FEE_TOOLTIP}
                  iconClassName="h-3.5 w-3.5 shrink-0"
                />
              ) : row.key === "facility" ? (
                <InfoTooltip
                  content={invoiceOfferFacilityFeeTooltip(feeDisplay)}
                  iconClassName="h-3.5 w-3.5 shrink-0"
                />
              ) : row.key === "net" ? (
                <InfoTooltip
                  content={INVOICE_OFFER_NET_DISBURSEMENT_TOOLTIP}
                  iconClassName="h-3.5 w-3.5 shrink-0"
                />
              ) : null;
            return (
              <OfferTermsDlRow
                key={row.key}
                label={
                  <span className="inline-flex items-center gap-1">
                    {row.label}
                    {tooltip}
                  </span>
                }
                value={
                  <span>
                    {formatMoneyCell(row.amount, row.kind)}
                    {row.hint ? (
                      <span className="mt-0.5 block text-meta font-normal text-muted-foreground">
                        {row.hint}
                      </span>
                    ) : null}
                  </span>
                }
                valueClassName={row.kind === "net" ? "font-semibold" : undefined}
              />
            );
          })}
        </OfferTermsDlColumn>
        {aside ? aside : null}
        {footer ? (
          <OfferTermsDlColumn title="Dates">{footer}</OfferTermsDlColumn>
        ) : null}
      </div>
    </div>
  );
}
