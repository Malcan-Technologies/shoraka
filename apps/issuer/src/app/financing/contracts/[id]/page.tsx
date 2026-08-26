"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  ProductCatalogName,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIssuerDashboardContract } from "@/hooks/use-issuer-dashboard";
import { useIssuerProduct } from "@/hooks/use-products";
import { resolveProductImageS3KeyFromWorkflow } from "@cashsouk/types";
import { resolveProductDisplayName } from "@/lib/product-display";
import { useApplicationLogsMany } from "@/hooks/use-application-logs";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
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
import { FacilityTransactionsPanel } from "@/components/financing/facility-transactions-panel";
import {
  buildFacilityTransactions,
  uniqueFacilityApplicationIds,
} from "@/components/financing/facility-transactions";
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
import { financeInvoiceApplicationHref } from "@/lib/finance-invoice-application-href";
import { formatContractReference } from "@cashsouk/types";
import { asContractForModal, asInvoiceForModal } from "@/types/issuer-dashboard";
import { resolveFacilityDisplayMetrics } from "@/lib/facility-capacity-display";
import { FacilityDualLimitSummaries } from "@/components/financing/facility-dual-limits";
import { resolveIssuerFacilityFeeBalance, resolveIssuerFacilityGate } from "@/lib/facility-enabled";
import { FacilityFeeReturnListener } from "@/components/facility-fee-return-listener";
import { FacilityFeeDrawdownBlockedNotice } from "@/components/financing/facility-fee-drawdown-blocked";
import { FacilityFeePaymentCard } from "@/components/financing/facility-fee-payment-card";
import {
  FacilityDisabledBanner,
  FacilityFeeBalanceSummary,
} from "@/components/financing/facility-fee-status";

type FacilityDetailTab = "invoices" | "transactions";

function isFacilityDetailTab(value: string | null): value is FacilityDetailTab {
  return value === "invoices" || value === "transactions";
}

function contractBusinessNumber(contractForModal: unknown): string | null {
  const details = asContractForModal(contractForModal)?.contract_details as
    | { number?: string }
    | undefined;
  return typeof details?.number === "string" && details.number.trim().length > 0
    ? details.number.trim()
    : null;
}

function ContractDetailsPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractId = params.id as string;
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = useState<FacilityDetailTab>(() =>
    isFacilityDetailTab(tabFromUrl) ? tabFromUrl : "invoices"
  );
  const [invoiceListFilters, setInvoiceListFilters] = useState<InvoiceFinancingListFiltersState>(
    DEFAULT_INVOICE_FINANCING_LIST_FILTERS
  );
  const [filtersForContractId, setFiltersForContractId] = useState(contractId);

  if (filtersForContractId !== contractId) {
    setFiltersForContractId(contractId);
    setInvoiceListFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS });
  }

  const { data, isLoading, isError, error } = useIssuerDashboardContract(orgId, contractId);
  const { data: notesData, isLoading: notesLoading } = useIssuerNotes();

  const row = data?.contract ?? null;
  const { data: productRecord } = useIssuerProduct(row?.productId ?? "");
  const productImageS3Key = resolveProductImageS3KeyFromWorkflow(productRecord?.workflow);
  const catalogProductName = resolveProductDisplayName(productRecord);
  const invoices = data?.invoices ?? [];
  const applicationIds = useMemo(
    () => (row ? uniqueFacilityApplicationIds(row, invoices) : []),
    [row, invoices]
  );
  const { data: applicationLogs, isLoading: logsLoading } = useApplicationLogsMany(applicationIds);
  const facilityNotes = useMemo(
    () => (notesData?.notes ?? []).filter((note) => note.sourceContractId === contractId),
    [notesData?.notes, contractId]
  );
  const transactions = useMemo(
    () =>
      row
        ? buildFacilityTransactions({
            contract: row,
            invoices,
            notes: facilityNotes,
            logs: applicationLogs,
          })
        : [],
    [row, invoices, facilityNotes, applicationLogs]
  );
  const filteredInvoices = useMemo(
    () => filterInvoices(invoices, { ...invoiceListFilters, customer: "" }),
    [invoices, invoiceListFilters]
  );

  const onTabChange = (value: string) => {
    if (!isFacilityDetailTab(value)) return;
    setTab(value);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", value);
    const qs = next.toString();
    router.replace(
      qs ? `/financing/contracts/${contractId}?${qs}` : `/financing/contracts/${contractId}`,
      { scroll: false }
    );
  };

  const metrics = resolveFacilityDisplayMetrics(row ?? {});
  const approvedNum = metrics.approved;
  const utilizedNum = metrics.utilized;
  const availableNum = metrics.available;
  const overUtilizedAmount =
    approvedNum != null && utilizedNum != null && utilizedNum > approvedNum
      ? utilizedNum - approvedNum
      : availableNum != null && availableNum < 0
        ? Math.abs(availableNum)
        : null;

  const contractPeriod =
    row?.contractStartDate && row?.contractEndDate
      ? `${formatDate(row.contractStartDate)} to ${formatDate(row.contractEndDate)}`
      : row?.contractStartDate || row?.contractEndDate
        ? formatDate(row.contractStartDate ?? row.contractEndDate)
        : EM_DASH;

  const productLabel = row?.productName?.trim()
    ? displayCell(row.productName)
    : catalogProductName ?? "Facility financing";

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
          message="Choose an organisation to view this facility."
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
          title="Could not load facility"
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
          title="Facility not found"
          message="This facility is not available or you do not have access."
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
  const facilityGate = resolveIssuerFacilityGate({
    contractDetails: modalContract.contract_details,
    facilityEnabled: row.facilityEnabled,
    facilityDisabledReason: row.facilityDisabledReason,
    contractStatus: row.contractStatus,
    facilityFeeUpfrontOutstanding: row.facilityFeeUpfrontOutstanding,
  });
  const feeBalance =
    row.facilityFeeCapAmount != null && row.facilityFeePaidAmount != null
      ? resolveIssuerFacilityFeeBalance({
          contractDetails: modalContract.contract_details,
          approvedFacilityAmount: row.approvedFacilityAmount,
          facilityFeeCapAmount: row.facilityFeeCapAmount,
          facilityFeePaidAmount: row.facilityFeePaidAmount,
          facilityFeeWaived: row.facilityFeeWaived,
        })
      : null;

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
            <Link href="/financing?tab=contracts" className="hover:text-foreground hover:underline">
              Financing
            </Link>
            <span aria-hidden>›</span>
            <span className="text-foreground">Facility {displayCell(contractHeading)}</span>
          </nav>
        }
        title={displayCell(contractHeading)}
        status={
          <IssuerFinancingStatusBadge
            kind={resolveIssuerContractDashboardBadge(row.contractStatus, {
              facilityFeeUpfrontOutstanding: row.facilityFeeUpfrontOutstanding,
            })}
          />
        }
        facts={
          <span>
            {displayCell(row.customerName)} · {contractPeriod}
          </span>
        }
        actions={
          <>
            {row.contractStatus === "APPROVED" ? (
              facilityGate.canStartDrawdown ? (
                <Button className="rounded-xl" asChild>
                  <Link href={financeInvoiceApplicationHref(contractId)}>Finance an invoice</Link>
                </Button>
              ) : (
                <Button
                  className="rounded-xl"
                  disabled
                  aria-disabled
                  aria-describedby={
                    facilityGate.requiresFacilityFeePayment
                      ? "facility-fee-drawdown-blocked"
                      : "facility-disabled-reason"
                  }
                >
                  Finance an invoice
                </Button>
              )
            ) : null}
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
          {overUtilizedAmount != null && overUtilizedAmount > 0 ? (
            <p className="text-meta font-medium leading-5 text-muted-foreground">
              Facility usage exceeds the approved limit. Please contact support.
            </p>
          ) : null}
          {facilityGate.enabled === false ? (
            <div id="facility-disabled-reason">
              <FacilityDisabledBanner reason={facilityGate.disabledReason} />
            </div>
          ) : facilityGate.requiresFacilityFeePayment ? (
            <FacilityFeeDrawdownBlockedNotice
              id="facility-fee-drawdown-blocked"
              href={`/financing/contracts/${contractId}`}
            />
          ) : null}
          <FacilityDualLimitSummaries metrics={metrics} />
          <KeyValueGrid
            columns={2}
            items={[
              { label: "CashSouk Reference", value: displayCell(cashSoukReference) },
              { label: "Contract number", value: displayCell(contractNumber) },
              {
                label: "Product",
                value: (
                  <ProductCatalogName
                    name={productLabel}
                    imageS3Key={productImageS3Key}
                    empty={EM_DASH}
                    size="xs"
                  />
                ),
              },
              { label: "Customer", value: displayCell(row.customerName) },
              { label: "Contract period", value: contractPeriod },
            ]}
          />
          {feeBalance ? <FacilityFeeBalanceSummary balance={feeBalance} /> : null}
        </CardContent>
      </Card>

      {row.contractStatus === "APPROVED" && row.facilityFeeUpfrontAmount != null ? (
        <FacilityFeePaymentCard
          contractId={contractId}
          upfrontAmount={row.facilityFeeUpfrontAmount}
          paidAmount={Math.max(
            0,
            row.facilityFeeUpfrontAmount - (row.facilityFeeUpfrontOutstanding ?? 0)
          )}
          outstanding={row.facilityFeeUpfrontOutstanding ?? 0}
        />
      ) : null}

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

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          <TabsTrigger value="invoices" className="rounded-lg">
            Related invoices
          </TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-lg">
            Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-6">
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
                  message="Invoices financed under this facility will appear here."
                  action={
                    facilityGate.canStartDrawdown ? (
                      <Button className="rounded-xl" asChild>
                        <Link href={financeInvoiceApplicationHref(contractId)}>
                          Finance an invoice
                        </Link>
                      </Button>
                    ) : undefined
                  }
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
                      facilityDisplayReference={row.displayReference}
                      productName={catalogProductName ?? row.productName}
                      productImageS3Key={productImageS3Key}
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
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <FacilityTransactionsPanel
            rows={transactions}
            isLoading={transactions.length === 0 && (notesLoading || logsLoading)}
          />
        </TabsContent>
      </Tabs>
      <FacilityFeeReturnListener contractId={contractId} />
    </div>
  );
}

export default function ContractDetailsPage() {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            issuerMainContentClassName,
            issuerPageGutterClassName,
            issuerContentMaxWidthClassName
          )}
        >
          <LoadingState variant="detail" />
        </div>
      }
    >
      <ContractDetailsPageContent />
    </Suspense>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5 shadow-none">
      <p className="text-meta font-medium leading-5 text-muted-foreground">{label}</p>
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
