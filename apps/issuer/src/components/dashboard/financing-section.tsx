"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MoreVertical, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FunnelIcon } from "@heroicons/react/24/outline";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useProducts } from "@/hooks/use-products";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { getOfferStatus, type OfferStatus } from "@/lib/offer-utils";
import { ReviewOfferModal } from "@/components/review-offer-modal";
import { formatMoneyDisplay } from "@cashsouk/ui";
import type { Product } from "@cashsouk/types";
import type { IssuerDashboardContract, IssuerDashboardData, IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { asContractForModal, asInvoiceForModal } from "@/types/issuer-dashboard";
import {
  formatStatus,
  resolveFundingProgressPercent,
  resolveFundingStatusText,
  resolveInvoiceCardBadge,
  type InvoiceCardBadgeKind,
} from "@/lib/issuer-dashboard-labels";

function offerBadge(offerStatus: OfferStatus) {
  if (!offerStatus) return null;
  if (offerStatus === "Offer expired") {
    return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Offer expired</Badge>;
  }
  return (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Offer received</Badge>
  );
}

function ReviewOfferButton({ show, onClick }: { show: boolean; onClick?: () => void }) {
  if (!show) return null;
  return (
    <Button type="button" size="sm" className="h-8 rounded-md px-3 text-xs font-medium" onClick={onClick}>
      Review offer
    </Button>
  );
}

function formatMoney(value: unknown) {
  return formatMoneyDisplay(value, "NA");
}

function formatDate(value: unknown) {
  if (value === null || value === undefined) return "NA";
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (typeof value === "number") d = new Date(value);
  else if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) d = new Date(Number(trimmed));
    else {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) d = new Date(parsed);
      else {
        const alt = trimmed.replace(/-/g, "/");
        const parsed2 = Date.parse(alt);
        if (!Number.isNaN(parsed2)) d = new Date(parsed2);
      }
    }
  } else {
    d = new Date(String(value));
  }
  if (!d || Number.isNaN(d.getTime())) return "NA";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function issuerInvoiceBadge(kind: InvoiceCardBadgeKind) {
  switch (kind) {
    case "draft":
      return <Badge variant="secondary">Draft</Badge>;
    case "pending_approval":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending approval</Badge>;
    case "amendment":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Amendment requested</Badge>;
    case "approved":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Approved</Badge>;
    case "in_progress":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Funding in progress</Badge>;
    case "minimum_funding":
      return (
        <Badge className="border border-primary/40 bg-primary/5 text-primary hover:bg-primary/5">
          Minimum funding reached
        </Badge>
      );
    case "funded":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Funded</Badge>;
    case "active":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    case "completed":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>;
    case "unsuccessful":
      return <Badge className="bg-red-100 text-red-600 hover:bg-red-100">Unsuccessful</Badge>;
    default:
      return <Badge variant="outline">In progress</Badge>;
  }
}

function contractStatusBadge(status: string) {
  const label = formatStatus(status);
  if (label.toLowerCase().includes("amendment")) {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Amendment required</Badge>;
  }
  if (label.toLowerCase().includes("draft") || label.toLowerCase().includes("pending")) {
    return <Badge variant="secondary">{label || "Draft"}</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{label || "Active"}</Badge>;
}

function groupDashboardByProduct(dashboard: IssuerDashboardData) {
  const productGroups: Record<string, { contracts: IssuerDashboardContract[]; invoices: IssuerDashboardInvoice[] }> =
    {};
  for (const c of dashboard.contracts) {
    const pid = c.productId?.trim() ? c.productId : "_none";
    if (!productGroups[pid]) productGroups[pid] = { contracts: [], invoices: [] };
    productGroups[pid].contracts.push(c);
  }
  for (const inv of dashboard.invoices) {
    const pid = inv.productId?.trim() ? inv.productId : "_none";
    if (!productGroups[pid]) productGroups[pid] = { contracts: [], invoices: [] };
    productGroups[pid].invoices.push(inv);
  }
  return productGroups;
}

function CollapsibleCategory({
  title,
  children,
  defaultOpen = true,
  filters,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  filters?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="px-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[15px] font-semibold">{title}</h4>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">{filters}</div>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}

export function FilterButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" className="h-8 text-xs font-medium gap-1 px-3">
      <FunnelIcon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

export function FinancingSection({ organizationId }: { organizationId?: string }) {
  const { data: dashboard, isLoading, isError, error, refetch } = useIssuerDashboard(organizationId);
  const { data: productsData } = useProducts({ page: 1, pageSize: 100, search: "", activeOnly: true });
  const products = useMemo(() => productsData?.products ?? [], [productsData]);

  const [offerModalContext, setOfferModalContext] = useState<Parameters<typeof ReviewOfferModal>[0]["context"]>(null);
  const offerModalOpen = offerModalContext !== null;

  const productNameMap = useMemo(() => {
    const map = new Map<string, string>();
    type WorkflowStep = { name?: string; config?: { name?: string } };
    products.forEach((p: Product) => {
      const workflow = (p.workflow ?? []) as WorkflowStep[];
      const financingStep = workflow.find((step) => String(step?.name).toLowerCase().includes("financing type"));
      const name =
        financingStep?.config?.name ||
        workflow[0]?.config?.name ||
        (p as Product & { name?: string; title?: string }).name ||
        (p as Product & { name?: string; title?: string }).title ||
        `Product ${p.id}`;
      map.set(p.id, name);
    });
    return map;
  }, [products]);

  const productGroups = useMemo(() => (dashboard ? groupDashboardByProduct(dashboard) : {}), [dashboard]);

  type ProductOrStub = Product | { id: string; name: string };

  const productsWithData = useMemo(() => {
    const fromProducts = products.filter(
      (p: Product) =>
        (productGroups[p.id]?.contracts?.length ?? 0) + (productGroups[p.id]?.invoices?.length ?? 0) > 0
    );
    const productIdsFromProducts = new Set(fromProducts.map((p: Product) => p.id));
    const orphanIds = Object.keys(productGroups).filter(
      (pid) =>
        pid !== "_none" &&
        !productIdsFromProducts.has(pid) &&
        (productGroups[pid]?.contracts?.length ?? 0) + (productGroups[pid]?.invoices?.length ?? 0) > 0
    );
    return [
      ...fromProducts,
      ...orphanIds.map((id) => ({ id, name: productNameMap.get(id) ?? `Product ${id}` })),
    ] as ProductOrStub[];
  }, [products, productGroups, productNameMap]);

  if (!organizationId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Loading financing data…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-3">
        <p className="font-medium text-destructive">Could not load financing</p>
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!dashboard || productsWithData.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        No financing activity yet. Use <span className="font-medium text-foreground">Get Financed</span> to start an
        application.
      </div>
    );
  }

  return (
    <>
      <ReviewOfferModal
        open={offerModalOpen}
        onOpenChange={(open) => !open && setOfferModalContext(null)}
        context={offerModalContext}
      />
      <div className="space-y-6">
        {productsWithData.map((product: ProductOrStub) => {
          const group = productGroups[product.id] ?? { contracts: [], invoices: [] };
          const productName =
            productNameMap.get(product.id) ??
            ("name" in product ? product.name : undefined) ??
            `Product ${product.id}`;

          return (
            <Card key={product.id} className="rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-5">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-[15px] leading-6">{productName}</h3>
                </div>
              </div>

              <div className="px-6 pb-6 space-y-8">
                <CollapsibleCategory
                  title="Contract financing"
                  defaultOpen
                  filters={
                    <>
                      <FilterButton label="Status" />
                      <FilterButton label="Date" />
                      <FilterButton label="Customer" />
                    </>
                  }
                >
                  <div className="space-y-4">
                    {group.contracts.length > 0 ? (
                      group.contracts.map((c) => {
                        const modalContract = asContractForModal(c.contractForModal);
                        const offerStatus = getOfferStatus(modalContract);
                        return (
                          <DashboardContractCard
                            key={c.id}
                            row={c}
                            offerStatus={offerStatus}
                            onReviewOffer={() =>
                              setOfferModalContext({
                                type: "contract",
                                applicationId: c.applicationId,
                                contract: modalContract,
                              })
                            }
                          />
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">No contract financing</p>
                    )}
                  </div>
                </CollapsibleCategory>

                <CollapsibleCategory
                  title="Invoice financing"
                  defaultOpen
                  filters={
                    <>
                      <FilterButton label="Status" />
                      <FilterButton label="Date" />
                      <FilterButton label="Customer" />
                    </>
                  }
                >
                  <div className="space-y-4">
                    {group.invoices.length > 0 ? (
                      group.invoices.map((inv) => {
                        const modalInvoice = asInvoiceForModal(inv.invoiceForModal);
                        const offerStatus = getOfferStatus(modalInvoice);
                        return (
                          <DashboardInvoiceCard
                            key={inv.id}
                            row={inv}
                            offerStatus={offerStatus}
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
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">No invoice financing</p>
                    )}
                  </div>
                </CollapsibleCategory>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function DashboardContractCard({
  row,
  offerStatus,
  onReviewOffer,
}: {
  row: IssuerDashboardContract;
  offerStatus: OfferStatus;
  onReviewOffer: () => void;
}) {
  const router = useRouter();
  const approved = row.approvedFacilityAmount != null ? Number(row.approvedFacilityAmount) : 0;
  const utilised = row.utilizedFacilityAmount != null ? Number(row.utilizedFacilityAmount) : 0;
  const utilisationPct = approved > 0 ? Math.round((utilised / approved) * 100) : 0;

  return (
    <Card className="rounded-lg border border-border bg-muted/40 shadow-none">
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium truncate">
              Contract : <span className="font-semibold">{row.title ?? "-"}</span>
            </p>
            <span className="ml-2">{contractStatusBadge(row.contractStatus)}</span>
            {offerBadge(offerStatus)}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ReviewOfferButton show={offerStatus === "Offer received"} onClick={onReviewOffer} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/financing/contracts/${row.id}`}>View details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => row.applicationId && router.push(`/applications/edit/${row.applicationId}`)}
                >
                  Make amendment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">{row.customerName ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contract period</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">
                {row.contractStartDate && row.contractEndDate
                  ? `${formatDate(row.contractStartDate)} to ${formatDate(row.contractEndDate)}`
                  : row.contractStartDate || row.contractEndDate
                    ? `${formatDate(row.contractStartDate ?? row.contractEndDate)}`
                    : "NA"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active notes</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">{row.activeNotesCount}</p>
            </div>
          </div>

          <div className="flex flex-col justify-between h-full">
            <div className="space-y-3 pt-2 md:pt-4">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-1.5 bg-foreground rounded-full" style={{ width: `${utilisationPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Utilized {formatMoney(utilised)}</span>
                <span>Available {row.availableFacilityAmount != null ? formatMoney(row.availableFacilityAmount) : "NA"}</span>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-[17px] leading-7 font-medium text-foreground">{formatMoney(utilised)}</p>
                  <p className="text-xs text-muted-foreground">(Utilised facility)</p>
                </div>
                <div className="text-right">
                  <p className="text-[17px] leading-7 font-medium text-foreground">{formatMoney(approved)}</p>
                  <p className="text-xs text-muted-foreground">(Approved facility)</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/financing/contracts/${row.id}`} className="text-xs font-medium text-primary hover:underline">
                View details →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DashboardInvoiceCard({
  row,
  offerStatus,
  onReviewOffer,
}: {
  row: IssuerDashboardInvoice;
  offerStatus: OfferStatus;
  onReviewOffer: () => void;
}) {
  const router = useRouter();
  const badgeKind = resolveInvoiceCardBadge(row.note, row.invoiceStatus);
  const progress = resolveFundingProgressPercent(row.note);
  const fundingLabel = resolveFundingStatusText(row.note);
  const noteRef = row.note?.noteReference ?? "-";
  const invDetails = asInvoiceForModal(row.invoiceForModal)?.details;
  const maturityRaw = invDetails?.maturity_date ?? row.note?.maturityDate ?? null;

  return (
    <Card className="rounded-lg border border-border bg-muted/40 shadow-none">
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium truncate">
              Invoice no : <span className="font-semibold">{row.invoiceNumber}</span>
            </p>
            <span className="ml-2">{issuerInvoiceBadge(badgeKind)}</span>
            {offerBadge(offerStatus)}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ReviewOfferButton show={offerStatus === "Offer received"} onClick={onReviewOffer} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => row.applicationId && router.push(`/applications/edit/${row.applicationId}`)}
                >
                  Make amendment
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => row.applicationId && router.push(`/applications/edit/${row.applicationId}`)}
                >
                  View details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Note no</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">{noteRef}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">{row.customerName ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoice value</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">{formatMoney(row.invoiceValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Financing amount</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">{formatMoney(row.financingAmount)}</p>
            </div>
            {row.note?.marketplaceStatusLabel ? (
              <p className="text-xs text-muted-foreground">
                Marketplace:{" "}
                <span className="font-medium text-foreground">{row.note.marketplaceStatusLabel}</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div>
                <p className="text-xs text-muted-foreground">Submission date</p>
                <p className="text-[17px] leading-7 font-medium text-foreground">{formatDate(row.submissionDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Funding deadline</p>
                <p className="text-[17px] leading-7 font-medium text-foreground">
                  {row.note?.fundingDeadline ? formatDate(row.note.fundingDeadline) : "NA"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Maturity date</p>
                <p className="text-[17px] leading-7 font-medium text-foreground">{formatDate(maturityRaw)}</p>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-1.5 bg-foreground rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{fundingLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
