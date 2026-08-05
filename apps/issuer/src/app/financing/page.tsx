"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon } from "@heroicons/react/24/outline";
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { useIssuerProducts } from "@/hooks/use-products";
import { asContractForModal, asInvoiceForModal } from "@/types/issuer-dashboard";
import type { IssuerDashboardContract, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { getOfferStatus } from "@/lib/offer-utils";
import { useIssuerFinancingActionableCount } from "@/hooks/use-issuer-financing-actionable-count";
import {
  isIssuerContractActionable,
  isIssuerInvoiceActionable,
  partitionByActionable,
} from "@/lib/issuer-financing-actionable";
import { DashboardContractCard } from "@/components/financing/contract-card";
import { DashboardInvoiceCard } from "@/components/financing/invoice-card";
import { FinancingAttentionList } from "@/components/financing/needs-attention-section";
import { IssuerNotesList } from "@/notes/components/issuer-notes-list";
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
  filterInvoices,
  invoiceFinancingFiltersActive,
  invoiceSubmissionPresetLabel,
  type ContractFinancingListFiltersState,
  type InvoiceFinancingListFiltersState,
} from "@/components/financing/filters";
import { getIssuerFinancingStatusPresentation } from "@/lib/issuer-dashboard-labels";

const TAB_CONTRACTS = "contracts";
const TAB_INVOICES = "invoices";
const TAB_NOTES = "notes";
const PAGE_SIZE_OPTIONS = [10, 25, 50];

type FinancingTab = typeof TAB_CONTRACTS | typeof TAB_INVOICES | typeof TAB_NOTES;

function isFinancingTab(value: string | null): value is FinancingTab {
  return value === TAB_CONTRACTS || value === TAB_INVOICES || value === TAB_NOTES;
}

type WorkflowStep = { name?: string; config?: { name?: string } };

function buildProductNameMap(products: Product[]) {
  const map = new Map<string, string>();
  products.forEach((p) => {
    const workflow = (p.workflow ?? []) as WorkflowStep[];
    const financingStep = workflow.find((step) =>
      String(step?.name).toLowerCase().includes("financing type")
    );
    const name =
      financingStep?.config?.name ||
      workflow[0]?.config?.name ||
      (p as Product & { name?: string; title?: string }).name ||
      (p as Product & { name?: string; title?: string }).title ||
      `Product ${p.id}`;
    map.set(p.id, name);
  });
  return map;
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
    .map((id) => ({ id, name: productNameMap.get(id) ?? `Product ${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function IssuerFinancingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id;
  const initialTab: FinancingTab = isFinancingTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as FinancingTab)
    : TAB_CONTRACTS;
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
    const nextTab = isFinancingTab(tabFromUrl) ? tabFromUrl : TAB_CONTRACTS;
    setTab(nextTab);
    if (nextTab === TAB_CONTRACTS) {
      setContractSearch(searchFromUrl);
    } else if (nextTab === TAB_INVOICES) {
      setInvoiceSearch(searchFromUrl);
    }
  }, [tabFromUrl, searchFromUrl]);

  const onTabChange = (next: string) => {
    if (!isFinancingTab(next)) return;
    setTab(next);
    if (next === TAB_CONTRACTS) setContractSearch("");
    if (next === TAB_INVOICES) setInvoiceSearch("");
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
  const { data: productsData } = useIssuerProducts({ page: 1, pageSize: 100, search: "" });
  const products = React.useMemo<Product[]>(() => productsData?.products ?? [], [productsData]);
  const productNameMap = React.useMemo(() => buildProductNameMap(products), [products]);

  const contracts = React.useMemo(() => dashboard?.contracts ?? [], [dashboard]);
  const invoices = React.useMemo(() => dashboard?.invoices ?? [], [dashboard]);
  const financingActionable = useIssuerFinancingActionableCount(organizationId);
  const contractsActionableCount = financingActionable.contracts;
  const invoicesActionableCount = financingActionable.invoices;
  const notesActionableCount = financingActionable.notes;

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
      const haystack = [c.title, c.customerName, productName, c.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [contracts, contractFilters, contractSearch, productNameMap]);

  const filteredInvoices = React.useMemo(() => {
    const base = filterInvoices(invoices, invoiceFilters);
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((i) => {
      const productName = productNameMap.get(i.productId ?? "") ?? "";
      const haystack = [
        i.invoiceNumber,
        i.customerName,
        i.note?.noteReference ?? "",
        productName,
        i.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, invoiceFilters, invoiceSearch, productNameMap]);

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
    if (contractSearch.trim()) {
      chips.push({
        id: "search",
        label: `Search: ${contractSearch.trim()}`,
        onRemove: () => setContractSearch(""),
      });
    }
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
  }, [contractSearch, contractFilters, productOptions]);

  const invoiceChips = React.useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (invoiceSearch.trim()) {
      chips.push({
        id: "search",
        label: `Search: ${invoiceSearch.trim()}`,
        onRemove: () => setInvoiceSearch(""),
      });
    }
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
  }, [invoiceSearch, invoiceFilters, productOptions]);

  const applyCta = (
    <Button asChild className="rounded-xl">
      <Link href="/applications/new">Apply for financing</Link>
    </Button>
  );

  const orderedContracts = React.useMemo(() => {
    const { attention, rest } = partitionByActionable(
      filteredContracts,
      isIssuerContractActionable
    );
    return { attention, rest, ordered: [...attention, ...rest] };
  }, [filteredContracts]);

  const orderedInvoices = React.useMemo(() => {
    const { attention, rest } = partitionByActionable(
      filteredInvoices,
      isIssuerInvoiceActionable
    );
    return { attention, rest, ordered: [...attention, ...rest] };
  }, [filteredInvoices]);

  const attentionContractIds = React.useMemo(
    () => new Set(orderedContracts.attention.map((c) => c.id)),
    [orderedContracts.attention]
  );
  const attentionInvoiceIds = React.useMemo(
    () => new Set(orderedInvoices.attention.map((i) => i.id)),
    [orderedInvoices.attention]
  );

  const financingShell = (children: React.ReactNode) => (
    <div className={issuerMainContentClassName}>
      <div className={cn("min-w-0 max-w-full", issuerPageGutterClassName)}>
        <PageShell
          title="Financing"
          description="Your contracts, invoices, and notes across all products."
          action={
            <Button
              asChild
              className="h-11 shrink-0 gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-brand hover:opacity-95"
            >
              <Link href="/applications/new">
                <PlusIcon className="h-4 w-4" />
                Apply for financing
              </Link>
            </Button>
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

  const pagedContracts = paginate(orderedContracts.ordered, contractPage, contractPageSize);
  const pagedInvoices = paginate(orderedInvoices.ordered, invoicePage, invoicePageSize);
  const pagedAttentionContracts = pagedContracts.filter((c) => attentionContractIds.has(c.id));
  const pagedRestContracts = pagedContracts.filter((c) => !attentionContractIds.has(c.id));
  const pagedAttentionInvoices = pagedInvoices.filter((i) => attentionInvoiceIds.has(i.id));
  const pagedRestInvoices = pagedInvoices.filter((i) => !attentionInvoiceIds.has(i.id));

  return financingShell(
    <>
      {isError && tab !== TAB_NOTES ? (
        <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load financing"}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value={TAB_CONTRACTS} className="gap-1.5">
            Contracts
            {contractsActionableCount > 0 ? (
              <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                {contractsActionableCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value={TAB_INVOICES} className="gap-1.5">
            Invoices
            {invoicesActionableCount > 0 ? (
              <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                {invoicesActionableCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value={TAB_NOTES} className="gap-1.5">
            Notes
            {notesActionableCount > 0 ? (
              <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                {notesActionableCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_CONTRACTS} className="mt-6 space-y-6">
          {isLoading ? (
            <LoadingState variant="cards" rows={3} />
          ) : (
            <>
              <ListToolbar
                searchValue={contractSearch}
                onSearchChange={setContractSearch}
                searchPlaceholder="Search contracts by title, customer, or product"
                appliedFilters={contractChips}
                onClearFilters={clearContractFilters}
                onReload={() => {
                  void refetch();
                }}
                isLoading={isLoading}
                countLabel={`${filteredContracts.length} ${
                  filteredContracts.length === 1 ? "contract" : "contracts"
                }${contractsActive ? ` of ${contracts.length}` : ""}`}
                filterGroups={
                  <FinancingContractFilterToolbar
                    rows={contracts}
                    value={contractFilters}
                    onChange={setContractFilters}
                    onClear={() =>
                      setContractFilters({ ...DEFAULT_CONTRACT_FINANCING_LIST_FILTERS })
                    }
                    productOptions={productOptions}
                  />
                }
              />

              {contracts.length === 0 ? (
                <EmptyState
                  title="No contract financing yet"
                  message="Apply for financing to open a contract facility."
                  action={applyCta}
                />
              ) : filteredContracts.length === 0 ? (
                <EmptyState
                  variant="no-results"
                  title="No matching contracts"
                  message="Try clearing filters or adjusting your search."
                  action={
                    <Button variant="outline" className="rounded-xl" onClick={clearContractFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <>
                  <FinancingAttentionList
                    attentionCount={orderedContracts.attention.length}
                    itemLabelPlural="contracts"
                    attentionOnPage={pagedAttentionContracts.map((c) => (
                      <DashboardContractCard
                        key={c.id}
                        row={c}
                        offerStatus={getOfferStatus(asContractForModal(c.contractForModal))}
                      />
                    ))}
                    restOnPage={pagedRestContracts.map((c) => (
                      <DashboardContractCard
                        key={c.id}
                        row={c}
                        offerStatus={getOfferStatus(asContractForModal(c.contractForModal))}
                      />
                    ))}
                  />
                  <Pagination
                    page={contractPage}
                    pageSize={contractPageSize}
                    total={orderedContracts.ordered.length}
                    onPageChange={setContractPage}
                    onPageSizeChange={setContractPageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    itemLabel="contracts"
                  />
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value={TAB_INVOICES} className="mt-6 space-y-6">
          {isLoading ? (
            <LoadingState variant="cards" rows={3} />
          ) : (
            <>
              <ListToolbar
                searchValue={invoiceSearch}
                onSearchChange={setInvoiceSearch}
                searchPlaceholder="Search invoices by number, customer, note, or product"
                appliedFilters={invoiceChips}
                onClearFilters={clearInvoiceFilters}
                onReload={() => {
                  void refetch();
                }}
                isLoading={isLoading}
                countLabel={`${filteredInvoices.length} ${
                  filteredInvoices.length === 1 ? "invoice" : "invoices"
                }${invoicesActive ? ` of ${invoices.length}` : ""}`}
                filterGroups={
                  <FinancingInvoiceFilterToolbar
                    rows={invoices}
                    value={invoiceFilters}
                    onChange={setInvoiceFilters}
                    onClear={() =>
                      setInvoiceFilters({ ...DEFAULT_INVOICE_FINANCING_LIST_FILTERS })
                    }
                    productOptions={productOptions}
                  />
                }
              />

              {invoices.length === 0 ? (
                <EmptyState
                  title="No invoice financing yet"
                  message="Apply for financing against an invoice to get started."
                  action={applyCta}
                />
              ) : filteredInvoices.length === 0 ? (
                <EmptyState
                  variant="no-results"
                  title="No matching invoices"
                  message="Try clearing filters or adjusting your search."
                  action={
                    <Button variant="outline" className="rounded-xl" onClick={clearInvoiceFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <>
                  <FinancingAttentionList
                    attentionCount={orderedInvoices.attention.length}
                    itemLabelPlural="invoices"
                    attentionOnPage={pagedAttentionInvoices.map((inv) => (
                      <DashboardInvoiceCard
                        key={inv.id}
                        row={inv}
                        offerStatus={getOfferStatus(asInvoiceForModal(inv.invoiceForModal))}
                      />
                    ))}
                    restOnPage={pagedRestInvoices.map((inv) => (
                      <DashboardInvoiceCard
                        key={inv.id}
                        row={inv}
                        offerStatus={getOfferStatus(asInvoiceForModal(inv.invoiceForModal))}
                      />
                    ))}
                  />
                  <Pagination
                    page={invoicePage}
                    pageSize={invoicePageSize}
                    total={orderedInvoices.ordered.length}
                    onPageChange={setInvoicePage}
                    onPageSizeChange={setInvoicePageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    itemLabel="invoices"
                  />
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value={TAB_NOTES} className="mt-6 space-y-6">
          <IssuerNotesList />
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
