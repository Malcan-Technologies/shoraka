"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useOrganization } from "@cashsouk/config";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailHeader,
  EmptyState,
  KeyValueGrid,
  LoadingState,
  formatMoneyDisplay,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { useIssuerDashboardContract } from "@/hooks/use-issuer-dashboard";
import {
  issuerContentMaxWidthClassName,
  issuerMainContentClassName,
  issuerPageGutterClassName,
} from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import { financingOfferHref } from "@/lib/financing-offer-href";
import {
  getIssuerOfferActionCtaFromOfferDetails,
  getOfferStatus,
  shouldShowIssuerReviewOfferCta,
} from "@/lib/offer-utils";
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
  displayCell,
  formatDate,
} from "@/components/financing/utils";
import { resolveIssuerContractDashboardBadge } from "@/lib/issuer-dashboard-labels";
import { formatContractReference } from "@cashsouk/types";
import { asContractForModal, asInvoiceForModal } from "@/types/issuer-dashboard";

function contractBusinessNumber(contractForModal: unknown): string | null {
  const details = asContractForModal(contractForModal)?.contract_details as
    | { number?: string }
    | undefined;
  return typeof details?.number === "string" && details.number.trim().length > 0
    ? details.number.trim()
    : null;
}

function formatMoney(value: unknown) {
  return formatMoneyDisplay(value, EM_DASH);
}

export default function ContractDetailsPage() {
  const params = useParams();
  const contractId = params.id as string;
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const [invoiceListFilters, setInvoiceListFilters] = useState<InvoiceFinancingListFiltersState>(
    DEFAULT_INVOICE_FINANCING_LIST_FILTERS
  );

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
    availableNum != null
      ? Math.max(0, availableNum)
      : approvedNum != null && utilizedNum != null
        ? Math.max(0, approvedNum - utilizedNum)
        : null;
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

  const shellClass = cn(
    issuerMainContentClassName,
    issuerPageGutterClassName,
    issuerContentMaxWidthClassName,
    "space-y-6"
  );

  if (!orgId) {
    return (
      <div className={shellClass}>
        <EmptyState
          title="Select an organisation"
          message="Choose an organisation to view this contract."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={shellClass}>
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={shellClass}>
        <EmptyState
          title="Could not load contract"
          message={error instanceof Error ? error.message : "Unknown error"}
          action={
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/financing?tab=contracts">Back to Financing</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!row) {
    return (
      <div className={shellClass}>
        <EmptyState
          title="Contract not found"
          message="This contract is not available or you do not have access."
          action={
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/financing?tab=contracts">Back to Financing</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const stats = row.invoiceStats;
  const modalContract = asContractForModal(row.contractForModal);
  const showReviewOffer = shouldShowIssuerReviewOfferCta(modalContract);
  const offerActionCta = getIssuerOfferActionCtaFromOfferDetails(modalContract.offer_details, {
    scope: "contract",
  });

  const contractNumber = contractBusinessNumber(row.contractForModal);
  const cashSoukReference = formatContractReference({
    displayReference: row.displayReference,
    businessNumber: contractNumber,
    id: row.id,
  });
  const contractHeading = row.title ?? contractNumber ?? cashSoukReference;

  return (
    <div className={shellClass}>
      <DetailHeader
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/financing?tab=contracts"
              className="hover:text-foreground hover:underline"
            >
              Financing
            </Link>
            <span aria-hidden>›</span>
            <span className="text-foreground">Contract {displayCell(contractHeading)}</span>
          </nav>
        }
        title={displayCell(contractHeading)}
        status={
          <IssuerFinancingStatusBadge
            kind={resolveIssuerContractDashboardBadge(row.contractStatus)}
          />
        }
        facts={
          <span>
            {displayCell(row.customerName)} · {contractPeriod}
          </span>
        }
        actions={
          <>
            {showReviewOffer ? (
              <div className="rounded-xl bg-status-action-bg p-0.5">
                <Button className="rounded-xl" asChild>
                  <Link href={financingOfferHref(row.applicationId)}>{offerActionCta.label}</Link>
                </Button>
              </div>
            ) : null}
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href={`/applications/${row.applicationId}`}>View application</Link>
            </Button>
          </>
        }
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Facility overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell
              label="Utilised"
              value={formatMoney(row.utilizedFacilityAmount)}
            />
            <MetricCell
              label="Approved"
              value={formatMoney(row.approvedFacilityAmount)}
            />
            <MetricCell
              label="Available"
              value={
                availableFacilityDisplay != null
                  ? formatMoney(availableFacilityDisplay)
                  : EM_DASH
              }
            />
            <MetricCell label="Utilisation" value={`${utilisationPct}%`} />
          </div>
          {overUtilizedAmount != null && overUtilizedAmount > 0 ? (
            <p className="text-xs font-medium leading-5 text-muted-foreground">
              Facility usage exceeds the approved limit. Please contact support.
            </p>
          ) : null}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Facility usage</span>
              <span>{utilisationPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-foreground/35 shadow-sm dark:bg-muted">
              <div
                className="h-3 rounded-full bg-foreground"
                style={{ width: `${Math.min(100, Math.max(0, utilisationPct))}%` }}
              />
            </div>
          </div>
          <KeyValueGrid
            columns={2}
            items={[
              { label: "CashSouk Reference", value: displayCell(cashSoukReference) },
              { label: "Contract number", value: displayCell(contractNumber) },
              { label: "Product", value: productLabel },
              { label: "Customer", value: displayCell(row.customerName) },
              { label: "Contract period", value: contractPeriod },
              {
                label: "Facility fee collected",
                value:
                  row.facilityFeeCapAmount != null && row.facilityFeePaidAmount != null
                    ? `${facilityFeePaidNum != null ? formatMoney(facilityFeePaidNum) : EM_DASH} / ${
                        facilityFeeCapNum != null ? formatMoney(facilityFeeCapNum) : EM_DASH
                      } cap`
                    : EM_DASH,
                tabular: true,
              },
            ]}
          />
          {row.facilityFeeCapAmount != null && row.facilityFeePaidAmount != null ? (
            <p className="flex items-start gap-1.5 text-sm leading-6 text-muted-foreground">
              <InformationCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Facility fee is deducted from each invoice financing disbursement until the cap is
                reached.
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Invoices ({stats.total})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricBox label="Approved" value={`${stats.approved}`} />
              <MetricBox label="Rejected" value={`${stats.rejected}`} />
              <MetricBox label="Unfinanced" value={`${stats.unfinanced}`} />
            </div>
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6 md:text-ui md:leading-7">
              <p className="text-base font-semibold text-foreground">
                Breakdown of approved invoices
              </p>
              <BreakdownItem label="Funding in progress" value={`${stats.fundingInProgress}`} />
              <BreakdownItem label="Active notes" value={`${stats.activeNotes}`} />
              <BreakdownItem label="Completed notes" value={`${stats.completedNotes}`} />
              <BreakdownItem label="Unsuccessful raise" value={`${stats.unsuccessfulRaise}`} />
              {stats.disputedNotes != null ? (
                <BreakdownItem label="Disputed notes" value={`${stats.disputedNotes}`} />
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0 sm:gap-4">
          <CardTitle className="text-xl sm:text-2xl">Related invoices</CardTitle>
          <FinancingInvoiceFilterToolbar
            rows={invoices}
            value={invoiceListFilters}
            onChange={setInvoiceListFilters}
            onClear={() => setInvoiceListFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS })}
            hideCustomer
          />
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              message="Invoices financed under this contract will appear here."
            />
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              variant="no-results"
              title="No matching invoices"
              message="Try clearing filters."
              action={
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    setInvoiceListFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((inv) => (
                <DashboardInvoiceCard
                  key={inv.id}
                  row={inv}
                  offerStatus={getOfferStatus(asInvoiceForModal(inv.invoiceForModal))}
                  contractFeeContext={{
                    facilityFeeRatePercent: (
                      modalContract.contract_details as Record<string, unknown> | null
                    )?.facility_fee_rate_percent,
                    facilityFeeCapAmount: row.facilityFeeCapAmount,
                    facilityFeePaidAmount: row.facilityFeePaidAmount,
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5 shadow-none">
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
