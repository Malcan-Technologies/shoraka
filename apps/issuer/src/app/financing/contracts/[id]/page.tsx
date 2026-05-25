"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrganization } from "@cashsouk/config";
import { useHeader, formatMoneyDisplay } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { useIssuerDashboardContract } from "@/hooks/use-issuer-dashboard";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import { DashboardInvoiceCard } from "@/components/financing/invoice-card";
import { FinancingInvoiceFilterToolbar } from "@/components/financing/filter-toolbars";
import {
  DEFAULT_INVOICE_FINANCING_LIST_FILTERS,
  filterInvoices,
  type InvoiceFinancingListFiltersState,
} from "@/components/financing/filters";
import {
  EM_DASH,
  IssuerFinancingStatusBadge,
  LabelValue,
  displayCell,
  formatDate,
} from "@/components/financing/utils";
import { ReviewOfferModal } from "../../../(application-management)/applications/components/ReviewOfferModal";
import { getOfferStatus } from "@/lib/offer-utils";
import { resolveIssuerContractDashboardBadge } from "@/lib/issuer-dashboard-labels";
import { asContractForModal, asInvoiceForModal } from "@/types/issuer-dashboard";
import type { Invoice } from "@cashsouk/types";
import type { NormalizedInvoice } from "../../../(application-management)/applications/status";

function formatMoney(value: unknown) {
  return formatMoneyDisplay(value, EM_DASH);
}

export default function ContractDetailsPage() {
  const params = useParams();
  const contractId = params.id as string;
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const { setTitle } = useHeader();
  const [offerModalContext, setOfferModalContext] = useState<{
    applicationId: string;
    invoice: NormalizedInvoice;
  } | null>(null);
  const [invoiceListFilters, setInvoiceListFilters] = useState<InvoiceFinancingListFiltersState>(
    DEFAULT_INVOICE_FINANCING_LIST_FILTERS
  );

  const toNormalizedInvoiceForOfferModal = (inv: Invoice): NormalizedInvoice => {
    const invoiceDetails = inv.details;
    const od = inv.offer_details as Record<string, unknown> | null | undefined;
    return {
      id: inv.id,
      number: invoiceDetails.number,
      contractId: inv.contract_id ?? null,
      maturityDate: invoiceDetails.maturity_date ?? null,
      value: Number.isFinite(invoiceDetails.value as number) ? invoiceDetails.value : null,
      appliedFinancing: null,
      document: "—",
      documentS3Key: null,
      financingOffered: od?.offered_amount != null ? String(od.offered_amount) : "—",
      platformFee: "—",
      profitRate: od?.offered_profit_rate_percent != null ? `${od.offered_profit_rate_percent}%` : "—",
      status: inv.status,
      offerStatus: null,
      canReviewOffer: true,
      offer_details: od,
      signedOfferLetterAvailable: false,
      signedOfferLetterS3Key: null,
      withdrawReason: undefined,
      reasonOrRemarks: undefined,
    };
  };

  useEffect(() => {
    setTitle("Contract");
  }, [setTitle]);

  useEffect(() => {
    setInvoiceListFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS });
  }, [contractId]);

  const { data, isLoading, isError, error } = useIssuerDashboardContract(orgId, contractId);

  const row = data?.contract ?? null;
  const invoices = data?.invoices ?? [];
  const filteredInvoices = useMemo(
    () => filterInvoices(invoices, { ...invoiceListFilters, customer: "" }),
    [invoices, invoiceListFilters]
  );

  const approvedNum = row?.approvedFacilityAmount != null ? Number(row.approvedFacilityAmount) : null;
  const utilizedNum = row?.utilizedFacilityAmount != null ? Number(row.utilizedFacilityAmount) : null;
  const availableNum = row?.availableFacilityAmount != null ? Number(row.availableFacilityAmount) : null;
  const overUtilizedAmount =
    approvedNum != null && utilizedNum != null && utilizedNum > approvedNum
      ? utilizedNum - approvedNum
      : availableNum != null && availableNum < 0
        ? Math.abs(availableNum)
        : null;
  const availableFacilityDisplay =
    availableNum != null ? Math.max(0, availableNum) : approvedNum != null && utilizedNum != null ? Math.max(0, approvedNum - utilizedNum) : null;
  const utilisationPct =
    approvedNum != null && utilizedNum != null && approvedNum > 0
      ? Math.round((utilizedNum / approvedNum) * 100)
      : 0;

  const facilityFeeCapNum =
    row?.facilityFeeCapAmount != null ? Number(row.facilityFeeCapAmount) : null;
  const facilityFeePaidNum =
    row?.facilityFeePaidAmount != null ? Number(row.facilityFeePaidAmount) : null;

  const contractPeriod =
    row?.contractStartDate && row?.contractEndDate
      ? `${formatDate(row.contractStartDate)} to ${formatDate(row.contractEndDate)}`
      : row?.contractStartDate || row?.contractEndDate
        ? formatDate(row.contractStartDate ?? row.contractEndDate)
        : EM_DASH;

  const productLabel =
    row?.productName?.trim() ? displayCell(row.productName) : "Contract Financing";

  const shellClass = cn(issuerMainContentClassName, issuerPageGutterClassName);

  if (!orgId) {
    return (
      <div className={shellClass}>
        <p className="text-[17px] leading-7 text-muted-foreground">Select an organization to view this contract.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${shellClass} flex min-h-[240px] items-center justify-center text-[17px] leading-7 text-muted-foreground`}>
        Loading contract…
      </div>
    );
  }

  if (isError) {
    return (
      <div className={shellClass}>
        <p className="font-medium text-destructive">Could not load contract</p>
        <p className="mt-2 text-[17px] leading-7 text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className={shellClass}>
        <p className="text-[17px] leading-7 text-muted-foreground">Contract not found or you do not have access.</p>
      </div>
    );
  }

  const stats = row.invoiceStats;

  return (
    <div className={cn(shellClass, "space-y-5 md:space-y-6")}>
      {offerModalContext && (
        <ReviewOfferModal
          type="invoice"
          applicationId={offerModalContext.applicationId}
          contractId={contractId}
          invoice={offerModalContext.invoice}
          requiresInvoiceSigning
          onClose={() => setOfferModalContext(null)}
        />
      )}

      <section className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
              {displayCell(row.title)}
            </h2>
            <IssuerFinancingStatusBadge kind={resolveIssuerContractDashboardBadge(row.contractStatus)} />
          </div>
          <p className="mt-0.5 text-sm leading-6 text-muted-foreground md:text-[15px] md:leading-7">
            {displayCell(row.customerName)} · {contractPeriod}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-10 shrink-0 gap-2 rounded-lg border-input px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:rounded-xl sm:px-4"
        >
          <Link href="/financing?tab=contracts">Back to Financing</Link>
        </Button>
      </section>

      <Card className="rounded-xl border border-border bg-background shadow-none">
        <div className="space-y-5 px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <LabelValue label="Product">{productLabel}</LabelValue>
                <LabelValue label="Customer">{displayCell(row.customerName)}</LabelValue>
                <LabelValue label="Contract period">{contractPeriod}</LabelValue>
              </div>

              <div className="min-w-0 w-full space-y-2">
                <LabelValue label="Available facility" tabular>
                  {availableFacilityDisplay != null ? formatMoney(availableFacilityDisplay) : EM_DASH}
                </LabelValue>
                {overUtilizedAmount != null && overUtilizedAmount > 0 ? (
                  <p className="text-xs font-medium leading-5 text-amber-700">
                    Over-utilised by {formatMoney(overUtilizedAmount)}
                  </p>
                ) : null}
                <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-foreground/35 shadow-sm dark:bg-muted">
                  <div
                    className="h-2 rounded-full bg-foreground"
                    style={{ width: `${Math.min(100, Math.max(0, utilisationPct))}%` }}
                  />
                </div>
                <div className="flex justify-between gap-4 sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-base font-semibold tabular-nums leading-7 text-foreground">
                      {formatMoney(row.utilizedFacilityAmount)}
                    </p>
                    <p className="text-xs font-normal leading-5 text-muted-foreground">(Utilised facility)</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-base font-semibold tabular-nums leading-7 text-foreground">
                      {formatMoney(row.approvedFacilityAmount)}
                    </p>
                    <p className="text-xs font-normal leading-5 text-muted-foreground">(Approved facility)</p>
                  </div>
                </div>

                {row.facilityFeeCapAmount != null && row.facilityFeePaidAmount != null ? (
                  <div className="mt-3 text-sm leading-6 text-muted-foreground">
                    <p>
                      Facility fee collected:{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {facilityFeePaidNum != null ? formatMoney(facilityFeePaidNum) : EM_DASH} /{" "}
                        {facilityFeeCapNum != null ? formatMoney(facilityFeeCapNum) : EM_DASH} cap
                      </span>
                    </p>
                    <p>Deducted progressively when invoice financing is disbursed.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-6 xl:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-base font-semibold leading-7 tracking-tight text-foreground md:text-lg">
                Total no. of invoices: {stats.total}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricBox label="Approved" value={`${stats.approved}`} />
                <MetricBox label="Rejected" value={`${stats.rejected}`} />
                <MetricBox label="Unfinanced" value={`${stats.unfinanced}`} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold leading-7 tracking-tight text-foreground md:text-lg">
                Breakdown of approved invoices
              </h3>
              <div className="grid grid-cols-1 gap-x-5 gap-y-2 text-sm leading-6 sm:grid-cols-2 md:text-[15px] md:leading-7">
                <BreakdownItem label="Funding in progress" value={`${stats.fundingInProgress}`} />
                <BreakdownItem label="Active notes" value={`${stats.activeNotes}`} />
                <BreakdownItem label="Completed notes" value={`${stats.completedNotes}`} />
                <BreakdownItem label="Unsuccessful raise" value={`${stats.unsuccessfulRaise}`} />
                {stats.disputedNotes != null ? (
                  <BreakdownItem label="Disputed notes" value={`${stats.disputedNotes}`} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="text-lg font-semibold leading-7 tracking-tight text-foreground md:text-xl">
            Invoices
          </h3>
          <FinancingInvoiceFilterToolbar
            rows={invoices}
            value={invoiceListFilters}
            onChange={setInvoiceListFilters}
            onClear={() => setInvoiceListFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS })}
            hideCustomer
          />
        </div>

        {invoices.length === 0 ? (
          <p className="text-[17px] leading-7 text-muted-foreground">No invoices for this contract.</p>
        ) : filteredInvoices.length === 0 ? (
          <p className="text-[17px] leading-7 text-muted-foreground">
            No invoices match these filters.{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setInvoiceListFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS })}
            >
              Clear filters
            </button>
          </p>
        ) : (
          filteredInvoices.map((inv) => {
            const modalInvoice = asInvoiceForModal(inv.invoiceForModal) as Invoice;
            return (
              <DashboardInvoiceCard
                key={inv.id}
                row={inv}
                offerStatus={getOfferStatus(modalInvoice)}
                contractFeeContext={{
                  facilityFeeRatePercent:
                    (asContractForModal(row.contractForModal).contract_details as Record<string, unknown> | null)
                      ?.facility_fee_rate_percent,
                  facilityFeeCapAmount: row.facilityFeeCapAmount,
                  facilityFeePaidAmount: row.facilityFeePaidAmount,
                }}
                onReviewOffer={() =>
                  setOfferModalContext({
                    applicationId: inv.applicationId,
                    invoice: toNormalizedInvoiceForOfferModal(modalInvoice) as unknown as NormalizedInvoice,
                  })
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-none">
      <p className="text-xs font-medium leading-5 text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums leading-7 text-foreground">{value}</p>
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0 font-normal text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
