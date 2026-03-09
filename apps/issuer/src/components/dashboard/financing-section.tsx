"use client";

import React, { useState, useMemo } from "react";
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
import { useOrganization } from "@cashsouk/config";
import { useOrganizationApplications } from "@/hooks/use-applications";
import { useProducts } from "@/hooks/use-products";
import { getOfferStatus, type OfferStatus } from "@/lib/offer-utils";
import { ReviewOfferModal } from "@/components/review-offer-modal";

/* ============================================================
   Real data (applications for active organization)
============================================================ */

/* ============================================================
   Badge helpers
============================================================ */

function contractBadge(status: any) {
  if (status === "Amendment required") {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Amendment required</Badge>
    );
  }
  return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
}

function invoiceBadge(status: any) {
  switch (status) {
    case "Draft":
      return <Badge variant="secondary">Draft</Badge>;
    case "In progress":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">In progress</Badge>;
    case "Funded":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Funded</Badge>;
    case "Completed":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>
      );
    case "Unsuccessful":
      return <Badge className="bg-red-100 text-red-600 hover:bg-red-100">Unsuccessful</Badge>;
  }
}

function offerBadge(offerStatus: OfferStatus) {
  if (!offerStatus) return null;

  if (offerStatus === "Offer expired") {
    return (
      <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
        Offer expired
      </Badge>
    );
  }

  return (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
      Offer received
    </Badge>
  );
}

function formatStatus(raw?: string | null) {
  if (!raw) return "";
  // Normalize variants like "DRAFT", "IN_PROGRESS", "In progress" -> "In progress"
  const s = String(raw).replace(/_/g, " ").toLowerCase();
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function ReviewOfferButton({
  show,
  onClick,
}: {
  show: boolean;
  onClick?: () => void;
}) {
  if (!show) return null;

  return (
    <Button
      type="button"
      size="sm"
      className="h-8 rounded-md px-3 text-xs font-medium"
      onClick={onClick}
    >
      Review offer
    </Button>
  );
}

function formatMoney(value: any) {
  if (value === null || value === undefined) return "NA";

  let num: number;
  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    // remove non-numeric characters except dot and minus
    const cleaned = value.replace(/[^\d.-]/g, "");
    num = cleaned === "" ? NaN : Number(cleaned);
  } else {
    num = Number(value);
  }

  if (Number.isNaN(num)) return "NA";

  const formatted = new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return formatted.replace(/^RM/, "RM ");
}

function formatDate(value: any) {
  if (value === null || value === undefined) return "NA";

  // If already a Date
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (typeof value === "number") d = new Date(value);
  else if (typeof value === "string") {
    // Try ISO first, then common formats
    const trimmed = value.trim();
    // If string contains only digits (timestamp)
    if (/^\d+$/.test(trimmed)) {
      d = new Date(Number(trimmed));
    } else {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) d = new Date(parsed);
      else {
        // Fallback: try replace - with / to handle some formats
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

/* ============================================================
   Flatten & group by product
============================================================ */

type FlatContract = {
  id: string;
  applicationId: string;
  productId: string;
  contract: any;
  applicationStatus: string;
  submissionDate?: string | null;
};

type FlatInvoice = {
  id: string;
  applicationId: string;
  productId: string;
  invoice: any;
  applicationStatus: string;
  applicationSubmittedAt?: string | null;
};

function flattenAndGroupByProduct(applications: any[]) {
  const contracts: FlatContract[] = [];
  const invoices: FlatInvoice[] = [];

  for (const app of applications || []) {
    const productId = app.financing_type?.product_id ?? "";
    if (!productId) continue;
    const appStatus = app.status ?? "";
    const submittedAt = app.submitted_at ?? app.submission_date ?? app.created_at ?? null;

    if (app.contract) {
      contracts.push({
        id: app.contract.id,
        applicationId: app.id,
        productId,
        contract: app.contract,
        applicationStatus: appStatus,
        submissionDate: submittedAt,
      });
    }

    for (const inv of app.invoices || []) {
      invoices.push({
        id: inv.id,
        applicationId: app.id,
        productId,
        invoice: inv,
        applicationStatus: appStatus,
        applicationSubmittedAt: submittedAt,
      });
    }
  }

  const sortBySubmissionDesc = (a: { submissionDate?: string | null }, b: { submissionDate?: string | null }) => {
    const da = a.submissionDate ? new Date(a.submissionDate).getTime() : 0;
    const db = b.submissionDate ? new Date(b.submissionDate).getTime() : 0;
    return db - da;
  };

  contracts.sort(sortBySubmissionDesc);
  invoices.sort((a, b) => {
    const da = a.applicationSubmittedAt ? new Date(a.applicationSubmittedAt).getTime() : 0;
    const db = b.applicationSubmittedAt ? new Date(b.applicationSubmittedAt).getTime() : 0;
    return db - da;
  });

  const productGroups: Record<string, { contracts: FlatContract[]; invoices: FlatInvoice[] }> = {};
  for (const c of contracts) {
    if (!productGroups[c.productId]) {
      productGroups[c.productId] = { contracts: [], invoices: [] };
    }
    productGroups[c.productId].contracts.push(c);
  }
  for (const inv of invoices) {
    if (!productGroups[inv.productId]) {
      productGroups[inv.productId] = { contracts: [], invoices: [] };
    }
    productGroups[inv.productId].invoices.push(inv);
  }

  return productGroups;
}

/* ============================================================
   Main
============================================================ */

export function FinancingSection() {
  const { activeOrganization } = useOrganization();
  const { data: applications = [] } = useOrganizationApplications(activeOrganization?.id);
  const { data: productsData } = useProducts({ page: 1, pageSize: 100, search: "", activeOnly: true } as any);
  const products = (productsData as any)?.products || [];

  const [offerModalContext, setOfferModalContext] = useState<Parameters<typeof ReviewOfferModal>[0]["context"]>(null);
  const offerModalOpen = offerModalContext !== null;

  const productNameMap = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p: any) => {
      const financingStep = p.workflow?.find((step: any) =>
        String(step?.name).toLowerCase().includes("financing type")
      );
      const name =
        financingStep?.config?.name ||
        p.workflow?.[0]?.config?.name ||
        p.name ||
        p.title ||
        `Product ${p.id}`;
      map.set(p.id, name);
    });
    return map;
  }, [products]);

  const productGroups = useMemo(
    () => flattenAndGroupByProduct(applications),
    [applications]
  );

  const productsWithData = useMemo(() => {
    const fromProducts = products.filter(
      (p: any) =>
        (productGroups[p.id]?.contracts?.length ?? 0) + (productGroups[p.id]?.invoices?.length ?? 0) > 0
    );
    const productIdsFromProducts = new Set(fromProducts.map((p: any) => p.id));
    const orphanIds = Object.keys(productGroups).filter(
      (pid) => !productIdsFromProducts.has(pid) &&
        ((productGroups[pid]?.contracts?.length ?? 0) + (productGroups[pid]?.invoices?.length ?? 0) > 0)
    );
    return [
      ...fromProducts,
      ...orphanIds.map((id) => ({ id, name: productNameMap.get(id) ?? `Product ${id}` })),
    ];
  }, [products, productGroups, productNameMap]);

  return (
    <>
      <ReviewOfferModal
        open={offerModalOpen}
        onOpenChange={(open) => !open && setOfferModalContext(null)}
        context={offerModalContext}
      />
      <div className="space-y-6">
      {productsWithData.map((product: any) => {
        const group = productGroups[product.id] ?? { contracts: [], invoices: [] };
        const productName = productNameMap.get(product.id) ?? product.name ?? `Product ${product.id}`;

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
                    group.contracts.map((c) => (
                      <ContractCard
                        key={c.id}
                        item={c.contract}
                        applicationId={c.applicationId}
                        offerStatus={getOfferStatus(c.contract)}
                        onReviewOffer={() =>
                          setOfferModalContext({
                            type: "contract",
                            applicationId: c.applicationId,
                            contract: c.contract,
                          })
                        }
                      />
                    ))
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
                    group.invoices.map((inv) => (
                      <InvoiceCard
                        key={inv.id}
                        item={inv.invoice}
                        applicationSubmittedAt={inv.applicationSubmittedAt}
                        applicationId={inv.applicationId}
                        offerStatus={getOfferStatus(inv.invoice)}
                        onReviewOffer={() =>
                          setOfferModalContext({
                            type: "invoice",
                            applicationId: inv.applicationId,
                            invoiceId: inv.id,
                            invoice: inv.invoice,
                          })
                        }
                      />
                    ))
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

/* ============================================================
   Category header: filters + separator + chevron far right
============================================================ */

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

/* ============================================================
   Cards: grid layout -> content | right column | action column
============================================================ */

function ContractCard({
  item,
  applicationId,
  offerStatus,
  onReviewOffer,
}: {
  item: any;
  applicationId: string;
  offerStatus: OfferStatus;
  onReviewOffer: () => void;
}) {
  const router = useRouter();
  const details = item.contract_details ?? {};
  const customer = item.customer_details?.name ?? details?.customer ?? "-";
  const start = details?.start_date;
  const end = details?.end_date;
  const approved = details?.approved_facility ?? 0;
  const utilised = details?.utilized_facility ?? 0;
  const utilisationPct = approved > 0 ? Math.round((utilised / approved) * 100) : 0;

  return (
    <Card className="rounded-lg border border-border bg-muted/40 shadow-none">
      <div className="px-5 py-4 space-y-4">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground" />

            <p className="text-sm font-medium truncate">
              Contract :{" "}
              <span className="font-semibold">{details?.title ?? item.id}</span>
            </p>

            <span className="ml-2">{contractBadge(formatStatus(item.status) || formatStatus(details?.status))}</span>
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
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => applicationId && router.push(`/applications/edit/${applicationId}`)}>
                  Make amendment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* BODY */}
        <div className="grid grid-cols-[1fr_320px] gap-8 items-start">

          {/* LEFT */}
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">
                {customer ?? "NA"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Contract period</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">
                {start || end
                  ? start && end
                    ? `${formatDate(start)} to ${formatDate(end)}`
                    : `${formatDate(start ?? end)}`
                  : "NA"}
              </p>
            </div>

            {item.activeNotes !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Active notes</p>
                <p className="text-[17px] leading-7 font-medium text-foreground">
                  {item.activeNotes}
                </p>
              </div>
            )}
          </div>

          {/* RIGHT */}
    <div className="flex flex-col justify-between h-full">

      {/* TOP CONTENT */}
      <div className="space-y-3 pt-4">

        {/* Progress */}
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-1.5 bg-foreground rounded-full"
            style={{ width: `${utilisationPct}%` }}
          />
        </div>

        {/* Numbers left & right */}
        <div className="flex justify-between">
          <div>
            <p className="text-[17px] leading-7 font-medium text-foreground">
              {formatMoney(utilised)}
            </p>
            <p className="text-xs text-muted-foreground">
              (Utilised facility)
            </p>
          </div>

          <div className="text-right">
            <p className="text-[17px] leading-7 font-medium text-foreground">
              {formatMoney(approved)}
            </p>
            <p className="text-xs text-muted-foreground">
              (Approved facility)
            </p>
          </div>
        </div>

      </div>

      {/* BOTTOM ACTION */}
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={() => applicationId && router.push(`/applications/edit/${applicationId}`)}
          className="text-xs font-medium text-primary hover:underline"
        >
          Make amendment →
        </button>
      </div>

    </div>
        </div>
      </div>
    </Card>
  );
}

export function InvoiceCard({
  item,
  applicationSubmittedAt,
  applicationId,
  offerStatus,
  onReviewOffer,
}: {
  item: any;
  applicationSubmittedAt?: string | null;
  applicationId?: string;
  offerStatus: OfferStatus;
  onReviewOffer: () => void;
}) {
  const router = useRouter();
  const details = item.details ?? {};
  const invoiceNumber = details.number ?? details.invoiceNo ?? item.id;
  const invoiceValue = details.value ?? details.invoiceValue ?? null;
  const financingAmount =
    details.financing_amount ??
    details.financingAmount ??
    (typeof invoiceValue === "number" && typeof details.financing_ratio_percent === "number"
      ? Math.round((invoiceValue * details.financing_ratio_percent) / 100)
      : undefined);
  const maturityDate = details.maturity_date ?? details.maturityDate ?? item.maturityDate ?? null;
  const submissionDate =
    details.submission_date ??
    details.submissionDate ??
    item.submissionDate ??
    item.created_at ??
    applicationSubmittedAt ??
    null;
  const status = formatStatus(item.status ?? details.status);

  return (
    <Card className="rounded-lg border border-border bg-muted/40 shadow-none">
      <div className="px-5 py-4 space-y-4">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground" />

            <p className="text-sm font-medium truncate">
              Invoice no :{" "}
              <span className="font-semibold">{invoiceNumber}</span>
            </p>

            <span className="ml-2">{invoiceBadge(status)}</span>
            {offerBadge(offerStatus)}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ReviewOfferButton
              show={offerStatus === "Offer received"}
              onClick={onReviewOffer}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-8 w-8"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => applicationId && router.push(`/applications/edit/${applicationId}`)}
                >
                  Make amendment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* BODY */}
        <div className="grid grid-cols-[1fr_320px] gap-8 items-start">

          {/* LEFT */}
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Note no</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">
                {item.noteNo ?? "NA"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">
                {item.customer ?? "NA"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Invoice value</p>
              <p className="text-[17px] leading-7 font-medium text-foreground">
                {formatMoney(invoiceValue)}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Financing amount
              </p>
              <p className="text-[17px] leading-7 font-medium text-foreground">
                {formatMoney(financingAmount)}
              </p>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-3">

            <div className="space-y-1">
              <div>
                <p className="text-xs text-muted-foreground">
                  Submission date
                </p>
                <p className="text-[17px] leading-7 font-medium text-foreground">
                  {formatDate(submissionDate)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Funding deadline
                </p>
                <p className="text-[17px] leading-7 font-medium text-foreground">
                  {formatDate(item.fundingDeadline)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Maturity date
                </p>
                <p className="text-[17px] leading-7 font-medium text-foreground">
                  {formatDate(maturityDate)}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2 pt-4">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-1.5 bg-foreground rounded-full"
                  style={{ width: `${item.progress}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {(() => {
                  // normalize funding label display per requested examples
                  const prog = typeof item.progress === "number" ? item.progress : Number(item.progress);
                  if (prog === 0) return "funding status (Not yet started)";
                  if (prog === 75) return "funding status: (75%)";
                  if (item.fundingLabel) return item.fundingLabel;
                  if (!Number.isNaN(prog)) return `funding status: (${prog}%)`;
                  return "funding status (Not yet started)";
                })()}
              </p>
            </div>

          </div>
        </div>
      </div>
    </Card>
  )
}

/* ============================================================
   Bits
============================================================ */

export function FilterButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" className="h-8 text-xs font-medium gap-1 px-3">
      <FunnelIcon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}


// "use client"

// import { useState } from "react"
// import {
//   ChevronDown,
//   ChevronUp,
//   MoreVertical,
//   FileText,
// } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { Card } from "@/components/ui/card"
// import { FunnelIcon } from "@heroicons/react/24/outline"

// /* ============================================================
//    Mock Application Data (Application Level)
// ============================================================ */

// const mockApplications = [
//   {
//     id: "app1",
//     title: "Mining Rig Repair 12654",
//     status: "Active",
//     contracts: [
//       {
//         id: "c1",
//         title: "Mining Rig Repair 12654",
//         customer: "Petronas Chemical Bhd",
//         period: "01/01/2026 to 31/12/2026",
//         utilised: "RM 10,000",
//         approved: "RM 50,000",
//       },
//     ],
//     invoices: [
//       {
//         id: "i1",
//         invoiceNo: "INV-11110",
//         status: "Draft",
//         submissionDate: "03/02/2026",
//         maturityDate: "31/07/2026",
//         invoiceValue: "RM 40,000",
//         financingAmount: "RM 30,000",
//         progress: 0,
//       },
//       {
//         id: "i2",
//         invoiceNo: "INV-11109",
//         status: "In progress",
//         submissionDate: "03/01/2026",
//         maturityDate: "31/06/2026",
//         invoiceValue: "RM 20,000",
//         financingAmount: "RM 15,000",
//         progress: 75,
//       },
//     ],
//   },
// ]

// /* ============================================================
//    Status Badge Helpers
// ============================================================ */

// function contractBadge(status: string) {
//   return (
//     <Badge className="bg-green-100 text-green-700">
//       {status}
//     </Badge>
//   )
// }

// function invoiceBadge(status: string) {
//   switch (status) {
//     case "Draft":
//       return <Badge variant="secondary">Draft</Badge>
//     case "In progress":
//       return <Badge className="bg-green-100 text-green-700">In progress</Badge>
//     case "Funded":
//       return <Badge className="bg-blue-100 text-blue-700">Funded</Badge>
//     case "Completed":
//       return <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>
//     case "Unsuccessful":
//       return <Badge className="bg-red-100 text-red-600">Unsuccessful</Badge>
//     default:
//       return null
//   }
// }

// /* ============================================================
//    Main Component
// ============================================================ */

// export function FinancingSection() {
//   const [openApplicationId, setOpenApplicationId] = useState<string | null>(
//     mockApplications[0].id
//   )

//   return (
//     <div className="space-y-6">

//       {mockApplications.map((app) => {
//         const isOpen = openApplicationId === app.id

//         return (
//           <Card
//             key={app.id}
//             className="rounded-xl border border-gray-200 shadow-sm"
//           >
//             {/* APPLICATION HEADER */}
//             <div
//               onClick={() => setOpenApplicationId(isOpen ? null : app.id)}
//               className="flex items-center justify-between p-6 cursor-pointer select-none border-b border-muted"
//             >
//               <div className="flex items-center gap-3">
//                 <FileText className="h-5 w-5 text-muted-foreground" />
//                 <h3 className="font-semibold text-base">
//                   {app.title}
//                 </h3>
//                 {contractBadge(app.status)}
//               </div>

//               {isOpen ? (
//                 <ChevronUp className="h-5 w-5 text-muted-foreground" />
//               ) : (
//                 <ChevronDown className="h-5 w-5 text-muted-foreground" />
//               )}
//             </div>

//             {/* APPLICATION BODY */}
//             {isOpen && (
//               <div className="px-6 pb-6 space-y-10">

//                 {/* CONTRACT SECTION */}
//                 <CollapsibleCategory title="Contract financing" filters={["Status", "Date", "Customer"]} >
//                   {app.contracts.map((c) => (
//                     <Card
//                       key={c.id}
//                       className="p-6 rounded-xl border border-gray-200"
//                     >
//                       <div className="flex justify-between">
//                         <div className="space-y-3">
//                           <p className="text-sm font-semibold">
//                             Contract : {c.title}
//                           </p>
//                           <p className="text-sm text-muted-foreground">
//                             Customer : {c.customer}
//                           </p>
//                           <p className="text-sm text-muted-foreground">
//                             Contract period : {c.period}
//                           </p>
//                         </div>

//                         <div className="w-[320px] space-y-3">
//                           <div className="h-2 bg-gray-200 rounded-full">
//                             <div className="h-2 bg-black rounded-full w-[40%]" />
//                           </div>
//                           <div className="flex justify-between text-sm text-muted-foreground">
//                             <span>{c.utilised}</span>
//                             <span>{c.approved}</span>
//                           </div>
//                         </div>

//                         <Button
//                           variant="ghost"
//                           size="icon"
//                           className="rounded-full h-9 w-9 ml-4"
//                         >
//                           <MoreVertical className="h-4 w-4" />
//                         </Button>
//                       </div>
//                     </Card>
//                   ))}
//                 </CollapsibleCategory>

//                 {/* INVOICE SECTION */}
//                 <CollapsibleCategory title="Invoice financing" filters={["Status", "Submission date"]}>
//                   {app.invoices.map((inv) => (
//                     <Card
//                       key={inv.id}
//                       className="p-6 rounded-xl border border-gray-200"
//                     >
//                       <div className="flex justify-between">
//                         <div className="space-y-4 flex-1">
//                           <div className="flex items-center gap-3">
//                             <p className="text-sm font-medium">
//                               Invoice no :{" "}
//                               <span className="font-semibold">
//                                 {inv.invoiceNo}
//                               </span>
//                             </p>
//                             {invoiceBadge(inv.status)}
//                           </div>

//                           <div className="space-y-1">
//                             <p className="text-sm text-muted-foreground">
//                               Invoice value : {inv.invoiceValue}
//                             </p>
//                             <p className="text-sm text-muted-foreground">
//                               Financing amount : {inv.financingAmount}
//                             </p>
//                           </div>
//                         </div>

//                         <div className="w-[320px] space-y-3">
//                           <p className="text-sm text-muted-foreground">
//                             Submission date: {inv.submissionDate}
//                           </p>
//                           <p className="text-sm text-muted-foreground">
//                             Maturity date: {inv.maturityDate}
//                           </p>

//                           <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
//                             <div
//                               className="h-2 bg-black rounded-full"
//                               style={{ width: `${inv.progress}%` }}
//                             />
//                           </div>
//                         </div>

//                         <Button
//                           variant="ghost"
//                           size="icon"
//                           className="rounded-full h-9 w-9 ml-4"
//                         >
//                           <MoreVertical className="h-4 w-4" />
//                         </Button>
//                       </div>
//                     </Card>
//                   ))}
//                 </CollapsibleCategory>

//               </div>
//             )}
//           </Card>
//         )
//       })}
//     </div>
//   )
// }

// /* ============================================================
//    Collapsible Category Component
// ============================================================ */

// function CollapsibleCategory({
//   title,
//   children,
//   filters,
// }: {
//   title: string
//   children: React.ReactNode
//   filters?: string[]
// }) {
//   const [open, setOpen] = useState(true)

//   return (
//     <div className="space-y-4">
//       {/* HEADER (no underline) */}
//       <div className="flex items-center justify-between">
//         {/* LEFT: Title */}
//         <h4 className="text-sm font-semibold text-foreground">{title}</h4>

//         {/* RIGHT: Filters + Separator + Chevron */}
//         <div className="flex items-center">
//           {/* Filters (do not toggle collapse) */}
//           {filters && (
//             <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
//               {filters.map((filter) => (
//                 <FilterButton key={filter} label={filter} />
//               ))}
//             </div>
//           )}

//           {/* Vertical Separator */}
//           <div className="mx-3 h-6 w-px bg-border" />

//           {/* Chevron (toggles collapse) */}
//           <button
//             type="button"
//             onClick={() => setOpen(!open)}
//             className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition"
//           >
//             {open ? (
//               <ChevronUp className="h-4 w-4 text-muted-foreground" />
//             ) : (
//               <ChevronDown className="h-4 w-4 text-muted-foreground" />
//             )}
//           </button>
//         </div>
//       </div>

//       {/* BODY */}
//       {open && <div className="space-y-4">{children}</div>}
//     </div>
//   )
// }


// function FilterButton({ label }: { label: string }) {
//   return (
//     <Button
//       variant="outline"
//       size="sm"
//       className="h-8 text-xs font-medium gap-1 px-3"
//     >
//       <FunnelIcon className="h-3.5 w-3.5" />
//       {label}
//     </Button>
//   )
// }



// "use client"

// import { useState } from "react"
// import { ChevronDown, ChevronUp, MoreVertical, FileText } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { Card } from "@/components/ui/card"

// /* ============================================================
//    Types
// ============================================================ */

// type ContractStatus = "Active" | "Amendment required"
// type InvoiceStatus =
//   | "Draft"
//   | "In progress"
//   | "Funded"
//   | "Completed"
//   | "Unsuccessful"

// /* ============================================================
//    Mock Data
// ============================================================ */

// const mockContracts = [
//   {
//     id: "c1",
//     title: "Mining Rig Repair 12654",
//     customer: "Petronas Chemical Bhd",
//     period: "01/01/2026 to 31/12/2026",
//     utilised: "RM 10,000",
//     approved: "RM 50,000",
//     status: "Active" as ContractStatus,
//   },
//   {
//     id: "c2",
//     title: "Development of Gate Valve",
//     customer: "Petronas Chemical Bhd",
//     period: "01/01/2026 to 31/12/2026",
//     utilised: "RM 10,000",
//     approved: "RM 50,000",
//     status: "Active" as ContractStatus,
//   },
// ]

// const mockInvoices = [
//   {
//     id: "i1",
//     invoiceNo: "INV-11110",
//     status: "Draft" as InvoiceStatus,
//     submissionDate: "03/02/2026",
//     maturityDate: "31/07/2026",
//     invoiceValue: "RM 40,000",
//     financingAmount: "RM 30,000",
//     progress: 0,
//     label: "Funding status (Not yet started)",
//   },
//   {
//     id: "i2",
//     invoiceNo: "INV-11109",
//     status: "In progress" as InvoiceStatus,
//     submissionDate: "03/01/2026",
//     maturityDate: "31/06/2026",
//     invoiceValue: "RM 20,000",
//     financingAmount: "RM 15,000",
//     progress: 75,
//     label: "Funding status (75%)",
//   },
// ]

// /* ============================================================
//    Badge Helpers
// ============================================================ */

// function contractBadge(status: ContractStatus) {
//   if (status === "Active")
//     return <Badge className="bg-green-100 text-green-700">Active</Badge>

//   return (
//     <Badge className="bg-red-100 text-red-600">
//       Amendment required
//     </Badge>
//   )
// }

// function invoiceBadge(status: InvoiceStatus) {
//   switch (status) {
//     case "Draft":
//       return <Badge variant="secondary">Draft</Badge>
//     case "In progress":
//       return <Badge className="bg-green-100 text-green-700">In progress</Badge>
//     case "Funded":
//       return <Badge className="bg-blue-100 text-blue-700">Funded</Badge>
//     case "Completed":
//       return <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>
//     case "Unsuccessful":
//       return <Badge className="bg-red-100 text-red-600">Unsuccessful</Badge>
//   }
// }

// /* ============================================================
//    Component
// ============================================================ */

// export function FinancingSection() {
//   const [contractOpen, setContractOpen] = useState(true)
//   const [invoiceOpen, setInvoiceOpen] = useState(true)

//   return (
//     <div className="space-y-10">

//       {/* ======================================================
//          CONTRACT SECTION
//       ====================================================== */}

//       <div>
//         <SectionHeader
//           title="Contract financing"
//           open={contractOpen}
//           onToggle={() => setContractOpen(!contractOpen)}
//         />

//         {contractOpen && (
//           <div className="space-y-4 mt-4">
//             {mockContracts.map((c) => (
//               <Card
//                 key={c.id}
//                 className="p-6 rounded-xl border border-gray-200 shadow-sm"
//               >
//                 <div className="flex justify-between">
//                   <div className="space-y-3">
//                     <div className="flex items-center gap-3">
//                       <FileText className="h-4 w-4 text-muted-foreground" />
//                       <p className="font-semibold text-sm">
//                         Contract : {c.title}
//                       </p>
//                       {contractBadge(c.status)}
//                     </div>

//                     <p className="text-sm text-muted-foreground">
//                       Customer : {c.customer}
//                     </p>

//                     <p className="text-sm text-muted-foreground">
//                       Contract period : {c.period}
//                     </p>
//                   </div>

//                   <div className="w-[320px] space-y-3">
//                     <div className="h-2 bg-gray-200 rounded-full">
//                       <div className="h-2 bg-black rounded-full w-[40%]" />
//                     </div>

//                     <div className="flex justify-between text-sm">
//                       <span className="text-muted-foreground">
//                         {c.utilised}
//                       </span>
//                       <span className="text-muted-foreground">
//                         {c.approved}
//                       </span>
//                     </div>

//                     <div className="text-right">
//                       <Button variant="link" className="text-primary p-0">
//                         View details →
//                       </Button>
//                     </div>
//                   </div>

//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     className="rounded-full h-9 w-9 ml-4"
//                   >
//                     <MoreVertical className="h-4 w-4" />
//                   </Button>
//                 </div>
//               </Card>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* ======================================================
//          INVOICE SECTION
//       ====================================================== */}

//       <div>
//         <SectionHeader
//           title="Invoice financing"
//           open={invoiceOpen}
//           onToggle={() => setInvoiceOpen(!invoiceOpen)}
//         />

//         {invoiceOpen && (
//           <div className="space-y-4 mt-4">
//             {mockInvoices.map((inv) => (
//               <Card
//                 key={inv.id}
//                 className="p-6 rounded-xl border border-gray-200 shadow-sm"
//               >
//                 <div className="flex justify-between">
//                   <div className="space-y-4 flex-1">
//                     <div className="flex items-center gap-3">
//                       <FileText className="h-4 w-4 text-muted-foreground" />
//                       <p className="text-sm font-medium">
//                         Invoice no :{" "}
//                         <span className="font-semibold">
//                           {inv.invoiceNo}
//                         </span>
//                       </p>
//                       {invoiceBadge(inv.status)}
//                     </div>

//                     <div className="space-y-1">
//                       <p className="text-sm text-muted-foreground">
//                         Invoice value :{" "}
//                         <span className="font-medium text-foreground">
//                           {inv.invoiceValue}
//                         </span>
//                       </p>
//                       <p className="text-sm text-muted-foreground">
//                         Financing amount :{" "}
//                         <span className="font-medium text-foreground">
//                           {inv.financingAmount}
//                         </span>
//                       </p>
//                     </div>
//                   </div>

//                   <div className="w-[320px] space-y-3">
//                     <div className="text-sm text-muted-foreground space-y-1">
//                       <p>
//                         Submission date:{" "}
//                         <span className="text-foreground font-medium">
//                           {inv.submissionDate}
//                         </span>
//                       </p>
//                       <p>
//                         Maturity date:{" "}
//                         <span className="text-foreground font-medium">
//                           {inv.maturityDate}
//                         </span>
//                       </p>
//                     </div>

//                     <div className="space-y-2">
//                       <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
//                         <div
//                           className="h-2 bg-black rounded-full"
//                           style={{ width: `${inv.progress}%` }}
//                         />
//                       </div>
//                       <p className="text-xs text-muted-foreground">
//                         {inv.label}
//                       </p>
//                     </div>
//                   </div>

//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     className="rounded-full h-9 w-9 ml-4"
//                   >
//                     <MoreVertical className="h-4 w-4" />
//                   </Button>
//                 </div>
//               </Card>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }

// /* ============================================================
//    Reusable Section Header
// ============================================================ */

// function SectionHeader({
//   title,
//   open,
//   onToggle,
// }: {
//   title: string
//   open: boolean
//   onToggle: () => void
// }) {
//   return (
//     <div
//       onClick={onToggle}
//       className="flex items-center justify-between cursor-pointer select-none"
//     >
//       <h3 className="text-lg font-semibold">{title}</h3>

//       {open ? (
//         <ChevronUp className="h-5 w-5 text-muted-foreground" />
//       ) : (
//         <ChevronDown className="h-5 w-5 text-muted-foreground" />
//       )}
//     </div>
//   )
// }