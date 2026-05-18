"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useOrganization } from "@cashsouk/config";
import { useHeader } from "@cashsouk/ui";
import type { Contract, Invoice, Product } from "@cashsouk/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { useProducts } from "@/hooks/use-products";
import { asContractForModal, asInvoiceForModal } from "@/types/issuer-dashboard";
import type { IssuerDashboardContract, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { getOfferStatus } from "@/lib/offer-utils";
import { ReviewOfferModal } from "@/components/review-offer-modal";
import { DashboardContractCard } from "@/components/financing/contract-card";
import { DashboardInvoiceCard } from "@/components/financing/invoice-card";
import {
  FinancingContractFilterToolbar,
  FinancingInvoiceFilterToolbar,
  type FinancingProductOption,
} from "@/components/financing/filter-toolbars";
import {
  DEFAULT_CONTRACT_FINANCING_LIST_FILTERS,
  DEFAULT_INVOICE_FINANCING_LIST_FILTERS,
  contractFinancingFiltersActive,
  filterContracts,
  filterInvoices,
  invoiceFinancingFiltersActive,
  type ContractFinancingListFiltersState,
  type InvoiceFinancingListFiltersState,
} from "@/components/financing/filters";

const TAB_CONTRACTS = "contracts";
const TAB_INVOICES = "invoices";

type FinancingTab = typeof TAB_CONTRACTS | typeof TAB_INVOICES;

function isFinancingTab(value: string | null): value is FinancingTab {
  return value === TAB_CONTRACTS || value === TAB_INVOICES;
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

function IssuerFinancingPageContent() {
  const { setTitle } = useHeader();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id;

  React.useEffect(() => {
    setTitle("Financing");
  }, [setTitle]);

  const initialTab: FinancingTab = isFinancingTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as FinancingTab)
    : TAB_CONTRACTS;
  const initialSearch = searchParams.get("search") ?? "";
  const [tab, setTab] = React.useState<FinancingTab>(initialTab);

  const onTabChange = (next: string) => {
    if (!isFinancingTab(next)) return;
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    params.delete("search");
    router.replace(`/financing?${params.toString()}`, { scroll: false });
  };

  const { data: dashboard, isLoading, isError, error, refetch } = useIssuerDashboard(organizationId);
  const { data: productsData } = useProducts({ page: 1, pageSize: 100, search: "", activeOnly: true });
  const products = React.useMemo<Product[]>(() => productsData?.products ?? [], [productsData]);
  const productNameMap = React.useMemo(() => buildProductNameMap(products), [products]);

  const contracts = React.useMemo(() => dashboard?.contracts ?? [], [dashboard]);
  const invoices = React.useMemo(() => dashboard?.invoices ?? [], [dashboard]);

  const productOptions = React.useMemo(
    () => deriveProductOptions(contracts, invoices, productNameMap),
    [contracts, invoices, productNameMap]
  );

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
  const [reloadSpin, setReloadSpin] = React.useState(false);

  type OfferContext =
    | { type: "contract"; applicationId: string; contract: Contract }
    | { type: "invoice"; applicationId: string; invoiceId: string; invoice: Invoice };
  const [offerModalContext, setOfferModalContext] = React.useState<OfferContext | null>(null);

  const handleReload = () => {
    setReloadSpin(true);
    void refetch().finally(() => {
      setTimeout(() => setReloadSpin(false), 500);
    });
  };

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

  if (!organizationId) {
    return (
      <div className={issuerMainContentClassName}>
        <div className={cn("min-w-0 max-w-full space-y-6", issuerPageGutterClassName)}>
          <PageHeader />
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            Select an organization to view financing.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={issuerMainContentClassName}>
      <div className={cn("min-w-0 max-w-full space-y-6", issuerPageGutterClassName)}>
        <ReviewOfferModal
          open={offerModalContext !== null}
          onOpenChange={(open) => !open && setOfferModalContext(null)}
          context={offerModalContext}
        />

        <PageHeader />

        {isError ? (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load financing"}
          </div>
        ) : null}

        {isLoading ? (
          <div className="text-muted-foreground">Loading financing...</div>
        ) : contracts.length === 0 && invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            <p>No financing activity yet.</p>
            <Button asChild variant="link" className="mt-2">
              <Link href="/applications/new">Apply for financing</Link>
            </Button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={onTabChange} className="w-full">
            <TabsList>
              <TabsTrigger value={TAB_CONTRACTS}>
                Contracts
                <Badge
                  variant="secondary"
                  className="ml-2 rounded-full bg-muted text-muted-foreground px-2 py-0 text-xs"
                >
                  {contracts.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value={TAB_INVOICES}>
                Invoices
                <Badge
                  variant="secondary"
                  className="ml-2 rounded-full bg-muted text-muted-foreground px-2 py-0 text-xs"
                >
                  {invoices.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={TAB_CONTRACTS} className="mt-6 space-y-6">
              <FilterRow
                search={contractSearch}
                onSearchChange={setContractSearch}
                searchPlaceholder="Search contracts by title, customer, or product"
                toolbar={
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
                hasFilters={contractsActive}
                onClearAll={clearContractFilters}
                onReload={handleReload}
                reloading={reloadSpin || isLoading}
                countLabel={`${filteredContracts.length} ${
                  filteredContracts.length === 1 ? "contract" : "contracts"
                }${contractsActive ? ` of ${contracts.length}` : ""}`}
              />

              {contracts.length === 0 ? (
                <EmptyState message="No contract financing yet." />
              ) : filteredContracts.length === 0 ? (
                <EmptyState message="No contracts match these filters." onClear={clearContractFilters} />
              ) : (
                <div className="space-y-4">
                  {filteredContracts.map((c) => {
                    const modalContract = asContractForModal(c.contractForModal);
                    return (
                      <DashboardContractCard
                        key={c.id}
                        row={c}
                        offerStatus={getOfferStatus(modalContract)}
                        onReviewOffer={() =>
                          setOfferModalContext({
                            type: "contract",
                            applicationId: c.applicationId,
                            contract: modalContract,
                          })
                        }
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value={TAB_INVOICES} className="mt-6 space-y-6">
              <FilterRow
                search={invoiceSearch}
                onSearchChange={setInvoiceSearch}
                searchPlaceholder="Search invoices by number, customer, note, or product"
                toolbar={
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
                hasFilters={invoicesActive}
                onClearAll={clearInvoiceFilters}
                onReload={handleReload}
                reloading={reloadSpin || isLoading}
                countLabel={`${filteredInvoices.length} ${
                  filteredInvoices.length === 1 ? "invoice" : "invoices"
                }${invoicesActive ? ` of ${invoices.length}` : ""}`}
              />

              {invoices.length === 0 ? (
                <EmptyState message="No invoice financing yet." />
              ) : filteredInvoices.length === 0 ? (
                <EmptyState message="No invoices match these filters." onClear={clearInvoiceFilters} />
              ) : (
                <div className="space-y-4">
                  {filteredInvoices.map((inv) => {
                    const modalInvoice = asInvoiceForModal(inv.invoiceForModal);
                    return (
                      <DashboardInvoiceCard
                        key={inv.id}
                        row={inv}
                        offerStatus={getOfferStatus(modalInvoice)}
                        onReviewOffer={() =>
                          setOfferModalContext({
                            type: "invoice",
                            applicationId: inv.applicationId,
                            invoiceId: inv.id,
                            invoice: modalInvoice,
                          })
                        }
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-semibold">Financing</h1>
        <p className="mt-1 text-muted-foreground">
          Your active facilities and invoice financing across all products.
        </p>
      </div>
      <Button
        asChild
        className="h-11 shrink-0 gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-brand hover:opacity-95"
      >
        <Link href="/applications/new">
          <PlusIcon className="h-4 w-4" />
          Apply for financing
        </Link>
      </Button>
    </div>
  );
}

function FilterRow({
  search,
  onSearchChange,
  searchPlaceholder,
  toolbar,
  hasFilters,
  onClearAll,
  onReload,
  reloading,
  countLabel,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  toolbar: React.ReactNode;
  hasFilters: boolean;
  onClearAll: () => void;
  onReload: () => void;
  reloading: boolean;
  countLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3 sm:justify-end">
        {toolbar}
        {hasFilters ? (
          <Button variant="ghost" onClick={onClearAll} className="h-11 gap-2 rounded-xl">
            <XMarkIcon className="h-4 w-4" />
            Clear
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={onReload}
          disabled={reloading}
          className="h-11 gap-2 rounded-xl"
        >
          <ArrowPathIcon className={cn("h-4 w-4", reloading && "animate-spin")} />
          Reload
        </Button>
        <Badge
          variant="secondary"
          className="h-11 rounded-xl border-transparent bg-muted px-4 text-sm font-medium text-muted-foreground"
        >
          {countLabel}
        </Badge>
      </div>
    </div>
  );
}

function EmptyState({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
      <p>{message}</p>
      {onClear ? (
        <Button variant="link" className="mt-2" onClick={onClear}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

export default function IssuerFinancingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <IssuerFinancingPageContent />
    </Suspense>
  );
}

