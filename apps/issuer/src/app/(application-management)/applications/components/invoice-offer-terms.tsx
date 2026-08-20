import type { ReactNode } from "react";
import { formatCurrency } from "@cashsouk/config";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvoiceFeeDisplay } from "@/lib/facility-fee-display";
import { buildInvoiceOfferMoneyRows } from "./invoice-offer-money-rows";

export const INVOICE_OFFER_PLATFORM_FEE_TOOLTIP =
  "Deducted from disbursement when funding closes, applied as a percentage of the funded amount.";

export const INVOICE_OFFER_PROFIT_RATE_TOOLTIP =
  "Profit per annum (%). Deducted during settlement when calculating the residual refund to the issuer.";

export const INVOICE_OFFER_FACILITY_FEE_TOOLTIP =
  "Deducted from disbursement when funding closes. For facility financing, this is collected progressively until the facility fee cap is reached.";

export const INVOICE_OFFER_NET_DISBURSEMENT_TOOLTIP =
  "Approved financing minus platform fee and facility fee. Final amount is confirmed when funding closes.";

function formatMoneyCell(amount: number | null, kind: "base" | "deduction" | "net"): string {
  if (amount == null) return "—";
  const formatted = formatCurrency(amount);
  return kind === "deduction" ? `− ${formatted}` : formatted;
}

export function InvoiceOfferTerms({
  invoiceNumber,
  invoiceValue,
  maturityDate,
  profitRate,
  requestedFinancing,
  approvedFinancing,
  includeFacilityFee,
  feeDisplay,
  footer,
}: {
  invoiceNumber: string;
  invoiceValue: number | null;
  maturityDate: string | null;
  profitRate: string;
  requestedFinancing: number | null;
  approvedFinancing: number | null;
  includeFacilityFee: boolean;
  feeDisplay: InvoiceFeeDisplay;
  footer?: ReactNode;
}) {
  const rows = buildInvoiceOfferMoneyRows({
    requestedFinancing,
    approvedFinancing,
    includeFacilityFee,
    feeDisplay,
  });
  const bodyRows = rows.filter((row) => row.kind !== "net");
  const netRow = rows.find((row) => row.kind === "net");

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-8 gap-y-3 text-ui sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-muted-foreground">Invoice number</dt>
          <dd className="font-medium break-words">{invoiceNumber}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">Invoice value</dt>
          <dd className="font-medium tabular-nums">
            {invoiceValue != null ? formatCurrency(invoiceValue) : "—"}
          </dd>
        </div>
        {maturityDate ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Maturity date</dt>
            <dd className="font-medium tabular-nums">{maturityDate}</dd>
          </div>
        ) : null}
        <div className="space-y-1">
          <dt className="inline-flex items-center gap-1 text-muted-foreground">
            Profit rate (p.a.)
            <InfoTooltip
              content={INVOICE_OFFER_PROFIT_RATE_TOOLTIP}
              iconClassName="h-3.5 w-3.5 shrink-0"
            />
          </dt>
          <dd className="font-medium tabular-nums">{profitRate}</dd>
        </div>
      </dl>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bodyRows.map((row) => (
              <TableRow key={row.key} className="hover:bg-transparent">
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {row.label}
                    {row.key === "platform" ? (
                      <InfoTooltip
                        content={INVOICE_OFFER_PLATFORM_FEE_TOOLTIP}
                        iconClassName="h-3.5 w-3.5 shrink-0"
                      />
                    ) : null}
                    {row.key === "facility" ? (
                      <InfoTooltip
                        content={
                          feeDisplay.facilityFeeFullyCollected
                            ? `${INVOICE_OFFER_FACILITY_FEE_TOOLTIP} No facility fee applies here because the cap has already been reached.`
                            : INVOICE_OFFER_FACILITY_FEE_TOOLTIP
                        }
                        iconClassName="h-3.5 w-3.5 shrink-0"
                      />
                    ) : null}
                  </span>
                  {row.hint ? (
                    <span className="mt-0.5 block text-meta text-muted-foreground">{row.hint}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoneyCell(row.amount, row.kind)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {netRow ? (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {netRow.label}
                    <InfoTooltip
                      content={INVOICE_OFFER_NET_DISBURSEMENT_TOOLTIP}
                      iconClassName="h-3.5 w-3.5 shrink-0"
                    />
                  </span>
                  {netRow.hint ? (
                    <span className="mt-0.5 block text-meta font-normal text-muted-foreground">
                      {netRow.hint}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoneyCell(netRow.amount, netRow.kind)}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
      {footer}
    </div>
  );
}
