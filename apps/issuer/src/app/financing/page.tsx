"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import {
  EmptyState,
  ListToolbar,
  LoadingState,
  PageShell,
  Pagination,
  type FilterChip,
} from "@cashsouk/ui";
import type { Product } from "@cashsouk/types";
import {
  buildProductDisplayMap,
  resolveIssuerProductDisplay,
  type ProductDisplay,
} from "@/lib/product-display";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import { ApplyForFinancingButton } from "@/components/apply-for-financing-button";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
import { useIssuerProducts } from "@/hooks/use-products";
import { asContractForModal, asInvoiceForModal } from "@/types/issuer-dashboard";
import type { IssuerDashboardContract, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { getOfferStatus } from "@/lib/offer-utils";
import { useIssuerFinancingActionableCount } from "@/hooks/use-issuer-financing-actionable-count";
import {
  isIssuerContractActionable,
  isIssuerInvoiceActionable,
  isFinancingInvoiceRowActionable,
  partitionByActionable,
} from "@/lib/issuer-financing-actionable";
import { DashboardContractCard } from "@/components/financing/contract-card";
import { DashboardInvoiceCard } from "@/components/financing/invoice-card";
import { DashboardNoteCard } from "@/components/financing/note-card";
import { FacilityAttentionCard } from "@/components/financing/facility-attention-card";
import { InvoiceAttentionCard } from "@/components/financing/invoice-attention-card";
import { NoteAttentionCard } from "@/components/financing/note-attention-card";
import { FinancingAttentionList, FinancingListSection } from "@/components/financing/needs-attention-section";
import {
  buildFinancingInvoiceRows,
  financingInvoiceRowMatchesFilters,
  financingInvoiceRowSearchHaystack,
  type FinancingInvoiceRow,
} from "@/components/financing/financing-invoice-rows";
import {
  isActiveFacility,
  partitionByPredicate,
  partitionInvoiceListRows,
} from "@/components/financing/financing-list-sections";
import {
  FinancingContractFilterToolbar,
  FinancingInvoiceFilterToolbar,
  type FinancingProductOption,
} from "@/components/financing/filter-toolbars";
import {
  DEFAULT_CONTRACT_FINANCING_LIST_FILTERS,
  DEFAULT_INVOICE_FINANCING_LIST_FILTERS,
  contractFinancingFiltersActive,
  contractPeriodPresetLabel,
  filterContracts,
  invoiceFinancingFiltersActive,
  invoiceSubmissionPresetLabel,
  type ContractFinancingListFiltersState,
  type InvoiceFinancingListFiltersState,
} from "@/components/financing/filters";
import { getIssuerFinancingStatusPresentation } from "@/lib/issuer-dashboard-labels";

const TAB_CONTRACTS = "contracts";
const TAB_INVOICES = "invoices";
const PAGE_SIZE_OPTIONS = [10, 25, 50];

type FinancingTab = typeof TAB_CONTRACTS | typeof TAB_INVOICES;

function isFinancingTab(value: string | null): value is FinancingTab {
  return value === TAB_CONTRACTS || value === TAB_INVOICES;
}

function tabFromSearchParam(value: string | null): FinancingTab {
  if (value === "notes") return TAB_INVOICES;
  return isFinancingTab(value) ? value : TAB_CONTRACTS;
}

function productNameMapFromDisplay(displayMap: Map<string, ProductDisplay>): Map<string, string> {
  const names = new Map<string, string>();
  for (const [id, display] of displayMap) names.set(id, display.name);
  return names;
}

function deriveProductOptions(
  contracts: IssuerDashboardContract[],
  invoices: IssuerDashboardInvoice[],
  productNameMap: Map<string, string>
): FinancingProductOption[] {
  const ids = new Set<string>();
  for (const c of contracts) if (c.productId) ids.add(c.productId);
  for (const i of invoices) if (i.productId) ids.add(i.productId);
  return [...ids]
    .map((id) => ({ id, name: productNameMap.get(id) || "Product" }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function renderFinancingContractRow(
  row: IssuerDashboardContract,
  productDisplayMap: Map<string, ProductDisplay>
) {
  const product = resolveIssuerProductDisplay(
    productDisplayMap,
    [row.productId],
    [row.productName]
  );
  return (
    <DashboardContractCard
      row={row}
      offerStatus={getOfferStatus(asContractForModal(row.contractForModal))}
      productName={product.name}
      productImageS3Key={product.imageS3Key}
    />
  );
}

function facilityDisplayReferenceFor(
  contractId: string | null | undefined,
  contracts: readonly IssuerDashboardContract[]
): string | null {
  if (!contractId) return null;
  return contracts.find((contract) => contract.id === contractId)?.displayReference ?? null;
}

function renderFinancingInvoiceRow(
  row: FinancingInvoiceRow,
  contracts: readonly IssuerDashboardContract[],
  productDisplayMap: Map<string, ProductDisplay>
) {
  if (row.kind === "note") {
    return <DashboardNoteCard note={row.note} />;
  }
  const relatedContract = contracts.find((contract) => contract.id === row.invoice.contractId);
  const product = resolveIssuerProductDisplay(
    productDisplayMap,
    [row.invoice.productId, relatedContract?.productId],
    [row.invoice.productName, relatedContract?.productName]
  );
  return (
    <DashboardInvoiceCard
      row={row.invoice}
      offerStatus={getOfferStatus(asInvoiceForModal(row.invoice.invoiceForModal))}
      facilityDisplayReference={facilityDisplayReferenceFor(row.invoice.contractId, contracts)}
      productName={product.name}
      productImageS3Key={product.imageS3Key}
      contractFeeContext={
        relatedContract
          ? {
              facilityFeeRatePercent: (
                asContractForModal(relatedContract.contractForModal).contract_details as
                  | Record<string, unknown>
                  | null
                  | undefined
              )?.facility_fee_rate_percent,
              facilityFeeCapAmount: relatedContract.facilityFeeCapAmount,
              facilityFeePaidAmount: relatedContract.facilityFeePaidAmount,
            }
          : undefined
      }
    />
  );
}

function renderFinancingInvoiceAttentionRow(
  row: FinancingInvoiceRow,
  contracts: readonly IssuerDashboardContract[],
  productDisplayMap: Map<string, ProductDisplay>
) {
  if (row.kind === "note") {
    return <NoteAttentionCard note={row.note} />;
  }
  const relatedContract = contracts.find((contract) => contract.id === row.invoice.contractId);
  const product = resolveIssuerProductDisplay(
    productDisplayMap,
    [row.invoice.productId, relatedContract?.productId],
    [row.invoice.productName, relatedContract?.productName]
  );
  return (
    <InvoiceAttentionCard
      row={row.invoice}
      facilityDisplayReference={facilityDisplayReferenceFor(row.invoice.contractId, contracts)}
      productName={product.name}
      productImageS3Key={product.imageS3Key}
    />
  );
}

function IssuerFinancingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id;
  const initialTab: FinancingTab = tabFromSearchParam(searchParams.get("tab"));
  const initialSearch = searchParams.get("search") ?? "";
  const [tab, setTab] = React.useState<FinancingTab>(initialTab);

  const [contractFilters, setContractFilters] = React.useState<ContractFinancingListFiltersState>(
    DEFAULT_CONTRACT_FINANCING_LIST_FILTERS
  );
  const [invoiceFilters, setInvoiceFilters] = React.useState<InvoiceFinancingListFiltersState>(
    DEFAULT_INVOICE_FINANCING_LIST_FILTERS
  );
  const [contractSearch, setContractSearch] = React.useState(
    initialTab === TAB_CONTRACTS ? initialSearch : ""
  );
  const [invoiceSearch, setInvoiceSearch] = React.useState(
    initialTab === TAB_INVOICES ? initialSearch : ""
  );
  const [contractPage, setContractPage] = React.useState(1);
  const [invoicePage, setInvoicePage] = React.useState(1);
  const [contractPageSize, setContractPageSize] = React.useState(10);
  const [invoicePageSize, setInvoicePageSize] = React.useState(10);

  const searchFromUrl = searchParams.get("search") ?? "";
  const tabFromUrl = searchParams.get("tab");

  const replaceFinancingQuery = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `/financing?${qs}` : "/financing", { scroll: false });
    },
    [router, searchParams]
  );

  // URL → tab + search (client navigations / deep links without remount).
  React.useEffect(() => {
    const nextTab = tabFromSearchParam(tabFromUrl);
    setTab(nextTab);
    if (nextTab === TAB_CONTRACTS) {
      setContractSearch(searchFromUrl);
    } else {
      setInvoiceSearch(searchFromUrl);
    }
  }, [tabFromUrl, searchFromUrl]);

  const onTabChange = (next: string) => {
    if (!isFinancingTab(next)) return;
    setTab(next);
    if (next === TAB_CONTRACTS) setContractSearch("");
    else setInvoiceSearch("");
    replaceFinancingQuery((params) => {
      params.set("tab", next);
      params.delete("search");
    });
  };

  // Local search → URL (debounced). Cleanup cancels stale writes when URL drives state.
  React.useEffect(() => {
    if (tab !== TAB_CONTRACTS && tab !== TAB_INVOICES) return;
    const localSearch = tab === TAB_CONTRACTS ? contractSearch : invoiceSearch;
    if (localSearch === searchFromUrl) return;
    const handle = window.setTimeout(() => {
      replaceFinancingQuery((params) => {
        params.set("tab", tab);
        if (localSearch.trim()) {
          params.set("search", localSearch);
        } else {
          params.delete("search");
        }
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [tab, contractSearch, invoiceSearch, searchFromUrl, replaceFinancingQuery]);

  const { data: dashboard, isLoading, isError, error, refetch } = useIssuerDashboard(organizationId);
  const { data: notesData, isLoading: isNotesLoading, refetch: refetchNotes } = useIssuerNotes();
  const { data: productsData } = useIssuerProducts({ page: 1, pageSize: 100, search: "" });
  const products = React.useMemo<Product[]>(() => productsData?.products ?? [], [productsData]);
  const productDisplayMap = React.useMemo(() => buildProductDisplayMap(products), [products]);
  const productNameMap = React.useMemo(
    () => productNameMapFromDisplay(productDisplayMap),
    [productDisplayMap]
  );

  const contracts = React.useMemo(() => dashboard?.contracts ?? [], [dashboard]);
  const invoices = React.useMemo(() => dashboard?.invoices ?? [], [dashboard]);
  const notes = React.useMemo(() => notesData?.notes ?? [], [notesData?.notes]);
  const financingActionable = useIssuerFinancingActionableCount(organizationId);
  const contractsActionableCount = financingActionable.contracts;
  const invoicesActionableCount = financingActionable.invoices;
  const invoicesListLoading = isLoading || isNotesLoading;

  const productOptions = React.useMemo(
    () => deriveProductOptions(contracts, invoices, productNameMap),
    [contracts, invoices, productNameMap]
  );

  const filteredContracts = React.useMemo(() => {
    const base = filterContracts(contracts, contractFilters);
    const q = contractSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => {
      const productName = productNameMap.get(c.productId ?? "") ?? "";
      const haystack = [c.title, c.customerName, productName, c.displayReference, c.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [contracts, contractFilters, contractSearch, productNameMap]);

  const invoiceRows = React.useMemo(
    () => buildFinancingInvoiceRows(invoices, notes, isIssuerInvoiceActionable),
    [invoices, notes]
  );

  const filteredInvoiceRows = React.useMemo(() => {
    const base = invoiceRows.filter((row) => financingInvoiceRowMatchesFilters(row, invoiceFilters));
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((row) => {
      const productName =
        row.kind === "invoice"
          ? resolveIssuerProductDisplay(
              productDisplayMap,
              [row.invoice.productId],
              [row.invoice.productName]
            ).name
          : row.note.productName ?? "";
      return financingInvoiceRowSearchHaystack(row, productName).includes(q);
    });
  }, [invoiceRows, invoiceFilters, invoiceSearch, productDisplayMap]);

  React.useEffect(() => {
    setContractPage(1);
  }, [contractSearch, contractFilters, contractPageSize]);

  React.useEffect(() => {
    setInvoicePage(1);
  }, [invoiceSearch, invoiceFilters, invoicePageSize]);

  const contractsActive = contractFinancingFiltersActive(contractFilters) || contractSearch !== "";
  const invoicesActive = invoiceFinancingFiltersActive(invoiceFilters) || invoiceSearch !== "";

  const clearContractFilters = () => {
    setContractFilters({ ...DEFAULT_CONTRACT_FINANCING_LIST_FILTERS });
    setContractSearch("");
  };
  const clearInvoiceFilters = () => {
    setInvoiceFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS });
    setInvoiceSearch("");
  };

  const contractChips = React.useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (contractFilters.statusKind !== "all") {
      chips.push({
        id: "status",
        label: `Status: ${getIssuerFinancingStatusPresentation(contractFilters.statusKind).label}`,
        onRemove: () => setContractFilters((f) => ({ ...f, statusKind: "all" })),
      });
    }
    if (contractFilters.periodPreset !== "all") {
      chips.push({
        id: "period",
        label: contractPeriodPresetLabel(contractFilters.periodPreset),
        onRemove: () => setContractFilters((f) => ({ ...f, periodPreset: "all" })),
      });
    }
    if (contractFilters.customer) {
      chips.push({
        id: "customer",
        label: `Customer: ${contractFilters.customer}`,
        onRemove: () => setContractFilters((f) => ({ ...f, customer: "" })),
      });
    }
    if (contractFilters.productId) {
      const name =
        productOptions.find((p) => p.id === contractFilters.productId)?.name ??
        contractFilters.productId;
      chips.push({
        id: "product",
        label: `Product: ${name}`,
        onRemove: () => setContractFilters((f) => ({ ...f, productId: "" })),
      });
    }
    return chips;
  }, [contractFilters, productOptions]);

  const invoiceChips = React.useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (invoiceFilters.statusKind !== "all") {
      chips.push({
        id: "status",
        label: `Status: ${getIssuerFinancingStatusPresentation(invoiceFilters.statusKind).label}`,
        onRemove: () => setInvoiceFilters((f) => ({ ...f, statusKind: "all" })),
      });
    }
    if (invoiceFilters.submissionPreset !== "all") {
      chips.push({
        id: "submission",
        label: invoiceSubmissionPresetLabel(invoiceFilters.submissionPreset),
        onRemove: () => setInvoiceFilters((f) => ({ ...f, submissionPreset: "all" })),
      });
    }
    if (invoiceFilters.customer) {
      chips.push({
        id: "customer",
        label: `Customer: ${invoiceFilters.customer}`,
        onRemove: () => setInvoiceFilters((f) => ({ ...f, customer: "" })),
      });
    }
    if (invoiceFilters.productId) {
      const name =
        productOptions.find((p) => p.id === invoiceFilters.productId)?.name ??
        invoiceFilters.productId;
      chips.push({
        id: "product",
        label: `Product: ${name}`,
        onRemove: () => setInvoiceFilters((f) => ({ ...f, productId: "" })),
      });
    }
    return chips;
  }, [invoiceFilters, productOptions]);

  const applyCta = (
    <ApplyForFinancingButton showIcon={false} className="rounded-xl" />
  );

  const attentionContracts = React.useMemo(
    () => partitionByActionable(contracts, isIssuerContractActionable).attention,
    [contracts]
  );
  const attentionContractIds = React.useMemo(
    () => new Set(attentionContracts.map((c) => c.id)),
    [attentionContracts]
  );

  const attentionInvoiceRows = React.useMemo(
    () => partitionByActionable(invoiceRows, isFinancingInvoiceRowActionable).attention,
    [invoiceRows]
  );
  const attentionInvoiceIds = React.useMemo(
    () => new Set(attentionInvoiceRows.map((row) => row.id)),
    [attentionInvoiceRows]
  );

  const listContracts = React.useMemo(
    () => filteredContracts.filter((c) => !attentionContractIds.has(c.id)),
    [filteredContracts, attentionContractIds]
  );
  const unfilteredListContracts = React.useMemo(
    () => contracts.filter((c) => !attentionContractIds.has(c.id)),
    [contracts, attentionContractIds]
  );

  const listInvoiceRows = React.useMemo(
    () => filteredInvoiceRows.filter((row) => !attentionInvoiceIds.has(row.id)),
    [filteredInvoiceRows, attentionInvoiceIds]
  );
  const unfilteredListInvoiceRows = React.useMemo(
    () => invoiceRows.filter((row) => !attentionInvoiceIds.has(row.id)),
    [invoiceRows, attentionInvoiceIds]
  );

  const { matched: activeContracts, rest: otherContracts } = React.useMemo(
    () => partitionByPredicate(listContracts, isActiveFacility),
    [listContracts]
  );
  const invoiceSections = React.useMemo(
    () => partitionInvoiceListRows(listInvoiceRows),
    [listInvoiceRows]
  );

  const contractRestTotal = otherContracts.length;
  const maxContractRestPage = Math.max(1, Math.ceil(contractRestTotal / contractPageSize) || 1);
  React.useEffect(() => {
    if (contractPage > maxContractRestPage) setContractPage(maxContractRestPage);
  }, [contractPage, maxContractRestPage]);

  const invoiceRestTotal = invoiceSections.other.length;
  const maxInvoiceRestPage = Math.max(1, Math.ceil(invoiceRestTotal / invoicePageSize) || 1);
  React.useEffect(() => {
    if (invoicePage > maxInvoiceRestPage) setInvoicePage(maxInvoiceRestPage);
  }, [invoicePage, maxInvoiceRestPage]);

  const pagedOtherContracts = paginate(otherContracts, contractPage, contractPageSize);
  const pagedOtherInvoices = paginate(invoiceSections.other, invoicePage, invoicePageSize);

  const financingShell = (children: React.ReactNode) => (
    <div className={issuerMainContentClassName}>
      <div className={cn("min-w-0 max-w-full", issuerPageGutterClassName)}>
        <PageShell
          title="Financing"
          description="See your facilities and the invoices you have financed."
          action={
            <ApplyForFinancingButton className="h-11 shrink-0 gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-brand hover:opacity-95" />
          }
        >
          {children}
        </PageShell>
      </div>
    </div>
  );

  if (!organizationId) {
    return financingShell(
      <EmptyState
        title="Select an organisation"
        message="Choose an organisation to view your financing."
      />
    );
  }

  return financingShell(
    <>
      {isError ? (
        <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "We couldn't load your financing."}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value={TAB_CONTRACTS} className="gap-1.5">
            Facilities
            {contractsActionableCount > 0 ? (
              <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-meta text-primary-foreground">
                {contractsActionableCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value={TAB_INVOICES} className="gap-1.5">
            Invoices
            {invoicesActionableCount > 0 ? (
              <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-meta text-primary-foreground">
                {invoicesActionableCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_CONTRACTS} className="mt-6 space-y-6">
          {isLoading ? (
            <LoadingState variant="cards" rows={3} />
          ) : (
            <>
              {contracts.length === 0 ? (
                <EmptyState
                  title="No facilities yet"
                  message="Apply for financing to get started."
                  action={applyCta}
                />
              ) : (
                <>
                  <FinancingAttentionList
                    attentionCount={attentionContracts.length}
                    carouselLabel="Facilities that need your attention"
                    attentionItems={attentionContracts.map((c) => {
                      const product = resolveIssuerProductDisplay(
                        productDisplayMap,
                        [c.productId],
                        [c.productName]
                      );
                      return {
                        key: c.id,
                        node: (
                          <FacilityAttentionCard
                            row={c}
                            productName={product.name}
                            productImageS3Key={product.imageS3Key}
                          />
                        ),
                      };
                    })}
                  />
                  <ListToolbar
                    searchValue={contractSearch}
                    onSearchChange={setContractSearch}
                    searchPlaceholder="Search by CashSouk reference, name, or customer"
                    appliedFilters={contractChips}
                    onClearFilters={clearContractFilters}
                    onReload={() => {
                      void refetch();
                    }}
                    isLoading={isLoading}
                    countLabel={`${listContracts.length} ${
                      listContracts.length === 1 ? "facility" : "facilities"
                    }${contractsActive ? ` of ${unfilteredListContracts.length}` : ""}`}
                    filterGroups={
                      <FinancingContractFilterToolbar
                        rows={contracts}
                        value={contractFilters}
                        onChange={setContractFilters}
                        onClear={() =>
                          setContractFilters({ ...DEFAULT_CONTRACT_FINANCING_LIST_FILTERS })
                        }
                        productOptions={productOptions}
                        showClearButton={false}
                      />
                    }
                  />
                  {listContracts.length === 0 ? (
                    <EmptyState
                      variant="no-results"
                      title="No matching facilities"
                      message="Try a different search or clear your filters."
                      action={
                        <Button variant="outline" className="rounded-xl" onClick={clearContractFilters}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <>
                      <FinancingListSection
                        title="Active facilities"
                        count={activeContracts.length}
                        items={activeContracts.map((c) => ({
                          key: c.id,
                          node: renderFinancingContractRow(c, productDisplayMap),
                        }))}
                      />
                      <FinancingListSection
                        title={activeContracts.length > 0 ? "Other facilities" : "Facilities"}
                        count={contractRestTotal}
                        items={pagedOtherContracts.map((c) => ({
                          key: c.id,
                          node: renderFinancingContractRow(c, productDisplayMap),
                        }))}
                      />
                      {contractRestTotal > 0 ? (
                        <Pagination
                          page={contractPage}
                          pageSize={contractPageSize}
                          total={contractRestTotal}
                          onPageChange={setContractPage}
                          onPageSizeChange={setContractPageSize}
                          pageSizeOptions={PAGE_SIZE_OPTIONS}
                          itemLabel="facilities"
                        />
                      ) : null}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value={TAB_INVOICES} className="mt-6 space-y-6">
          {invoicesListLoading ? (
            <LoadingState variant="cards" rows={3} />
          ) : (
            <>
              {invoiceRows.length === 0 ? (
                <EmptyState
                  title="No invoices yet"
                  message="Apply for financing to get started."
                  action={applyCta}
                />
              ) : (
                <>
                  <FinancingAttentionList
                    attentionCount={attentionInvoiceRows.length}
                    carouselLabel="Invoices that need your attention"
                    attentionItems={attentionInvoiceRows.map((row) => ({
                      key: row.id,
                      node: renderFinancingInvoiceAttentionRow(row, contracts, productDisplayMap),
                    }))}
                  />
                  <ListToolbar
                    searchValue={invoiceSearch}
                    onSearchChange={setInvoiceSearch}
                    searchPlaceholder="Search by CashSouk reference, number, or customer"
                    appliedFilters={invoiceChips}
                    onClearFilters={clearInvoiceFilters}
                    onReload={() => {
                      void refetch();
                      void refetchNotes();
                    }}
                    isLoading={invoicesListLoading}
                    countLabel={`${listInvoiceRows.length} ${
                      listInvoiceRows.length === 1 ? "invoice" : "invoices"
                    }${invoicesActive ? ` of ${unfilteredListInvoiceRows.length}` : ""}`}
                    filterGroups={
                      <FinancingInvoiceFilterToolbar
                        rows={invoices}
                        value={invoiceFilters}
                        onChange={setInvoiceFilters}
                        onClear={() =>
                          setInvoiceFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS })
                        }
                        productOptions={productOptions}
                        showClearButton={false}
                      />
                    }
                  />
                  {listInvoiceRows.length === 0 ? (
                    <EmptyState
                      variant="no-results"
                      title="No matching invoices"
                      message="Try a different search or clear your filters."
                      action={
                        <Button variant="outline" className="rounded-xl" onClick={clearInvoiceFilters}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <>
                      <FinancingListSection
                        title="Active invoices"
                        count={invoiceSections.active.length}
                        items={invoiceSections.active.map((row) => ({
                          key: row.id,
                          node: renderFinancingInvoiceRow(row, contracts, productDisplayMap),
                        }))}
                      />
                      <FinancingListSection
                        title="Fully funded"
                        count={invoiceSections.funded.length}
                        items={invoiceSections.funded.map((row) => ({
                          key: row.id,
                          node: renderFinancingInvoiceRow(row, contracts, productDisplayMap),
                        }))}
                      />
                      <FinancingListSection
                        title="Funding now"
                        count={invoiceSections.fundingNow.length}
                        items={invoiceSections.fundingNow.map((row) => ({
                          key: row.id,
                          node: renderFinancingInvoiceRow(row, contracts, productDisplayMap),
                        }))}
                      />
                      <FinancingListSection
                        title={
                          invoiceSections.active.length > 0 ||
                          invoiceSections.funded.length > 0 ||
                          invoiceSections.fundingNow.length > 0
                            ? "Other invoices"
                            : "Invoices"
                        }
                        count={invoiceRestTotal}
                        items={pagedOtherInvoices.map((row) => ({
                          key: row.id,
                          node: renderFinancingInvoiceRow(row, contracts, productDisplayMap),
                        }))}
                      />
                      {invoiceRestTotal > 0 ? (
                        <Pagination
                          page={invoicePage}
                          pageSize={invoicePageSize}
                          total={invoiceRestTotal}
                          onPageChange={setInvoicePage}
                          onPageSizeChange={setInvoicePageSize}
                          pageSizeOptions={PAGE_SIZE_OPTIONS}
                          itemLabel="invoices"
                        />
                      ) : null}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

    </>
  );
}


export default function IssuerFinancingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <IssuerFinancingPageContent />
    </Suspense>
  );
}
