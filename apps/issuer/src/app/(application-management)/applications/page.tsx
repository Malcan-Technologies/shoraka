"use client";

/** Applications dashboard. Data from useApplicationsData. Status config in status.ts. */

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  PlusIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { useHeader } from "@cashsouk/ui";
import { formatCurrency, createApiClient } from "@cashsouk/config";
import { useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STATUS, FILTER_STATUSES, FINANCING_TYPES } from "./status";
import { useApplicationsData } from "./use-applications-data";
import { ReviewOfferModal } from "./components/ReviewOfferModal";
import type { NormalizedApplication, NormalizedInvoice } from "./status";

const BADGE_BASE = "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border";
const BADGE_FALLBACK = "border-slate-500/30 bg-slate-500/10 text-slate-600";

function StatusBadge({ badgeKey }: { badgeKey: string }) {
  const s = STATUS[badgeKey];
  return (
    <span className={cn(BADGE_BASE, s?.color ?? BADGE_FALLBACK)}>
      {s?.label ?? badgeKey}
    </span>
  );
}

const DOCUMENT_NAME_MAX_LENGTH = 40;

/** Single date display format used across the page. e.g. "10 Mar 2026" */
function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return "—";
  return format(new Date(date), "d MMM yyyy");
}

function truncateDocumentName(name: string): string {
  if (name.length <= DOCUMENT_NAME_MAX_LENGTH) return name;
  return `${name.slice(0, DOCUMENT_NAME_MAX_LENGTH)}…`;
}

function DocumentDownloadLink({
  documentName,
  documentS3Key,
  onDownload,
  disabled,
}: {
  documentName: string;
  documentS3Key: string | null;
  onDownload: (s3Key: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [loading, setLoading] = React.useState(false);
  const displayName = truncateDocumentName(documentName);
  if (!documentS3Key || disabled) {
    return <span className="text-[15px] text-muted-foreground" title={documentName}>{displayName}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[15px]">
      <span title={documentName}>{displayName}</span>
      <button
        type="button"
        onClick={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            await onDownload(documentS3Key);
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
        aria-label={`Download ${documentName}`}
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
      </button>
    </span>
  );
}

function ApplicationCard({
  application,
  onDocumentDownload,
  onReviewContractOffer,
  onReviewInvoiceOffer,
}: {
  application: NormalizedApplication;
  onDocumentDownload: (s3Key: string) => Promise<void>;
  onReviewContractOffer?: (contractId: string) => void;
  onReviewInvoiceOffer?: (invoice: NormalizedInvoice) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const { cardStatus } = application;
  const isDraft = application.status === "draft";
  const isGenericDraft = application.type === "Generic";
  const hasContract = application.type === "Contract financing";

  const invoicesDisabled = hasContract && application.contractStatus !== "APPROVED";

  const useDraftCardLayout = isDraft && isGenericDraft;

  const displayId = application.id.slice(-8);
  const showFinancingLabel = !isGenericDraft;

  return (
    <>
      <Card className="rounded-2xl border bg-card shadow-sm md:shadow">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">
                Application ID {displayId}
                {showFinancingLabel ? ` - ${application.type}` : ""}
              </span>
              <StatusBadge badgeKey={cardStatus.badgeKey} />
            </div>
            <div className="flex items-center gap-2">
              {/* Make Amendments: only for Action Required (AMENDMENT_REQUESTED). Links to /edit amendment flow. */}
              {cardStatus.showMakeAmendments && (
                <Button size="sm" className="rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-sm" asChild>
                  <Link href={`/applications/edit/${application.id}`}>
                    Make Amendments
                  </Link>
                </Button>
              )}
              {cardStatus.showReviewOffer && (() => {
                const contractLink = hasContract && application.contractId;
                const invoiceLink = !hasContract && application.invoices.find((inv) => inv.canReviewOffer);
                if (contractLink && onReviewContractOffer) {
                  return (
                    <Button
                      size="sm"
                      className="rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                      onClick={() => onReviewContractOffer(application.contractId!)}
                    >
                      Review Contract Financing Offer
                    </Button>
                  );
                }
                if (invoiceLink && onReviewInvoiceOffer) {
                  return (
                    <Button
                      size="sm"
                      className="rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                      onClick={() => onReviewInvoiceOffer(invoiceLink)}
                    >
                      Review Offer
                    </Button>
                  );
                }
                return (
                  <Button size="sm" className="rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-sm" disabled>
                    Review Offer
                  </Button>
                );
              })()}
              {/* Edit Application: only for drafts. Links to /edit. Non-drafts get Withdraw only. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {isDraft ? (
                    <>
                      <DropdownMenuItem className="cursor-pointer" asChild>
                        <Link href={`/applications/edit/${application.id}`}>
                          Edit Application
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => {}}
                      >
                        Delete Draft
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {}}
                    >
                      Withdraw Application
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {useDraftCardLayout ? (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                This application is still being set up.
              </p>
              <div className="space-y-1 pt-2">
              <div className="text-sm text-muted-foreground">
                Application created:{" "}
                <span className="text-foreground">
                  {formatDate(application.applicationDate)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Application submitted:{" "}
                <span className="text-foreground">—</span>
              </div>
              </div>
            </div>
          ) : (
          <div className="flex flex-wrap justify-between gap-6">
            <div className="space-y-1">
              {hasContract && application.contractTitle && (
                <div className="text-sm text-muted-foreground">
                  Contract title:{" "}
                  <span className="text-foreground">
                    {application.contractTitle}
                  </span>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Customer:{" "}
                <span className="text-foreground">{application.customer}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Application created:{" "}
                <span className="text-foreground">
                  {formatDate(application.applicationDate)}
                </span>
              </div>
              {/* When the issuer submitted the application to admin. Helps issuer know how long it has been waiting. */}
              <div className="text-sm text-muted-foreground">
                Application submitted:{" "}
                <span className="text-foreground">
                  {formatDate(application.submittedAt)}
                </span>
              </div>
            </div>
            {hasContract && (
              <div className="space-y-1 text-right text-sm">
                <div className="text-muted-foreground">
                  Contract value:{" "}
                  <span className="text-foreground">
                    {application.contractValue != null
                      ? formatCurrency(application.contractValue)
                      : "—"}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Facility applied:{" "}
                  <span className="text-foreground">
                    {application.facilityApplied != null
                      ? formatCurrency(application.facilityApplied)
                      : "—"}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Approved facility:{" "}
                  <span className="text-foreground">
                    {application.approvedFacility}
                  </span>
                </div>
              </div>
            )}
          </div>
          )}
          {!useDraftCardLayout && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Hide details" : "View details"}
            </button>
          </div>
          )}

          {!useDraftCardLayout && expanded && (
            <div className="mt-4 relative">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Invoice table
              </h3>
              {invoicesDisabled && (
                <p className="text-xs text-muted-foreground mb-2">
                  Invoices will be available after the contract offer is accepted.
                </p>
              )}
              <div className={cn("overflow-hidden rounded-xl border", invoicesDisabled && "relative opacity-90")}>
              {invoicesDisabled && (
                <div
                  className="absolute inset-0 bg-slate-500/15 z-10 rounded-xl pointer-events-auto"
                  aria-hidden
                />
              )}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                    <TableHead className="text-sm font-semibold py-3 px-4">
                      Invoice number
                    </TableHead>
                    <TableHead className="text-sm font-semibold py-3 px-4">
                      Maturity date
                    </TableHead>
                    <TableHead className="text-sm font-semibold text-right py-3 px-4 tabular-nums">
                      Invoice value
                    </TableHead>
                    <TableHead className="text-sm font-semibold text-right py-3 px-4 tabular-nums">
                      Applied financing
                    </TableHead>
                    <TableHead className="text-sm font-semibold py-3 px-4">
                      Document
                    </TableHead>
                    <TableHead className="text-sm font-semibold text-right py-3 px-4 tabular-nums">
                      Financing offered
                    </TableHead>
                    <TableHead className="text-sm font-semibold text-right py-3 px-4 tabular-nums">
                      Profit rate
                    </TableHead>
                    <TableHead className="text-sm font-semibold py-3 px-4">
                      Status
                    </TableHead>
                    <TableHead className="text-sm font-semibold text-right py-3 px-4 w-[200px]">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {application.invoices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-8 text-sm text-muted-foreground"
                      >
                        No invoices available
                      </TableCell>
                    </TableRow>
                  ) : (
                    application.invoices.map((inv: NormalizedInvoice) => {
                      const invStatus = String(inv.status ?? "").toUpperCase();
                      const showReviewOffer = invStatus === "SENT" && inv.offerStatus === "Offer received";
                      const canReview = inv.canReviewOffer;
                      const showMakeAmendments = invStatus === "AMENDMENT_REQUESTED";
                      const invDisabled = invoicesDisabled;
                      return (
                        <TableRow
                          key={inv.id}
                          className="odd:bg-muted/40 hover:bg-muted border-b border-border last:border-b-0"
                        >
                          <TableCell className="text-[15px] py-3 px-4 align-middle">
                            {inv.number}
                          </TableCell>
                          <TableCell className="text-[15px] py-3 px-4 align-middle">
                            {formatDate(inv.maturityDate)}
                          </TableCell>
                          <TableCell className="text-right text-[15px] py-3 px-4 align-middle tabular-nums">
                            {inv.value ? formatCurrency(inv.value) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-[15px] py-3 px-4 align-middle tabular-nums">
                            {inv.appliedFinancing != null
                              ? formatCurrency(inv.appliedFinancing)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-[15px] py-3 px-4 align-middle">
                            <DocumentDownloadLink
                              documentName={inv.document}
                              documentS3Key={inv.documentS3Key}
                              onDownload={onDocumentDownload}
                              disabled={invDisabled}
                            />
                          </TableCell>
                          <TableCell className="text-right text-[15px] py-3 px-4 align-middle tabular-nums">
                            {inv.financingOffered}
                          </TableCell>
                          <TableCell className="text-right text-[15px] py-3 px-4 align-middle tabular-nums">
                            {inv.profitRate}
                          </TableCell>
                          <TableCell className="py-3 px-4 align-middle">
                            <StatusBadge
                              badgeKey={inv.status.toLowerCase()}
                            />
                          </TableCell>
                          <TableCell className="py-3 px-4 align-top">
                            <div
                              className={cn(
                                "flex items-start justify-end gap-2",
                                invDisabled && "pointer-events-none opacity-60"
                              )}
                            >
                              {(showReviewOffer || showMakeAmendments) && (
                                <div className="flex flex-col items-center gap-1 min-w-[140px]">
                                  {showReviewOffer && (
                                    canReview && !invDisabled && onReviewInvoiceOffer ? (
                                      <Button
                                        size="sm"
                                        className="h-8 w-full min-w-[140px] rounded-xl text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                                        onClick={() => onReviewInvoiceOffer(inv)}
                                      >
                                        Review Offer
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        className="h-8 w-full min-w-[140px] rounded-xl text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                                        disabled
                                      >
                                        Review Offer
                                      </Button>
                                    )
                                  )}
                                  {showMakeAmendments && (
                                    <Button
                                      size="sm"
                                      className="h-8 w-full min-w-[140px] rounded-xl text-xs font-medium bg-amber-600 text-white hover:bg-amber-700"
                                      asChild
                                    >
                                      <Link href={`/applications/edit/${application.id}`}>
                                        Make Amendments
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 mt-0"
                                  >
                                    <EllipsisVerticalIcon className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => {}}
                                  >
                                    Withdraw Invoice
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

const PER_PAGE_OPTIONS = [4, 8, 12] as const;

export default function ApplicationsPage() {
  const { setTitle } = useHeader();
  const { applications, isLoading } = useApplicationsData();

  /* --- Review offer modal: opens when user clicks Review Offer. --- */
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false);
  const [offerType, setOfferType] = React.useState<"contract" | "invoice">("contract");
  const [selectedContractId, setSelectedContractId] = React.useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = React.useState<NormalizedInvoice | null>(null);

  const openReviewContractOffer = React.useCallback((contractId: string) => {
    console.log("Opening review offer modal", { type: "contract", contractId });
    setOfferType("contract");
    setSelectedContractId(contractId);
    setSelectedInvoice(null);
    setReviewModalOpen(true);
  }, []);

  const openReviewInvoiceOffer = React.useCallback((invoice: NormalizedInvoice) => {
    console.log("Opening review offer modal", { type: "invoice", invoice });
    setOfferType("invoice");
    setSelectedContractId(null);
    setSelectedInvoice(invoice);
    setReviewModalOpen(true);
  }, []);

  /* --- FILTER: state. Status, Financing, Date (created + submitted), Search. --- */
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [financingFilter, setFinancingFilter] = React.useState("all");
  const [createdFilter, setCreatedFilter] = React.useState("all");
  const [submittedFilter, setSubmittedFilter] = React.useState("all");
  const [customerFilter, setCustomerFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(4);

  React.useEffect(() => {
    setTitle("Applications");
  }, [setTitle]);

  const filteredApplications = React.useMemo(() => {
    let list = [...applications];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.customer.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.invoices.some((inv) => inv.number.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (financingFilter !== "all") {
      const match =
        financingFilter === "contract"
          ? "Contract financing"
          : "Invoice financing";
      list = list.filter((a) => a.type === match);
    }
    if (createdFilter !== "all") {
      const now = new Date();
      const cutoff = new Date(now);
      if (createdFilter === "7d") cutoff.setDate(now.getDate() - 7);
      else if (createdFilter === "30d") cutoff.setDate(now.getDate() - 30);
      else if (createdFilter === "90d") cutoff.setDate(now.getDate() - 90);
      const cutoffTime = cutoff.getTime();
      list = list.filter(
        (a) => new Date(a.applicationDate).getTime() >= cutoffTime
      );
    }
    if (submittedFilter !== "all") {
      const now = new Date();
      const cutoff = new Date(now);
      if (submittedFilter === "7d") cutoff.setDate(now.getDate() - 7);
      else if (submittedFilter === "30d") cutoff.setDate(now.getDate() - 30);
      else if (submittedFilter === "90d") cutoff.setDate(now.getDate() - 90);
      const cutoffTime = cutoff.getTime();
      list = list.filter((a) => {
        if (!a.submittedAt) return false;
        return new Date(a.submittedAt).getTime() >= cutoffTime;
      });
    }
    if (customerFilter !== "all") {
      list = list.filter((a) => a.customer === customerFilter);
    }
    return list;
  }, [applications, search, statusFilter, financingFilter, createdFilter, submittedFilter, customerFilter]);

  const paginatedApplications = filteredApplications.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const totalCount = applications.length;
  const uniqueCustomers = React.useMemo(
    () => [...new Set(applications.map((a) => a.customer).filter(Boolean))].sort(),
    [applications]
  );
  const filterCount = [
    statusFilter !== "all",
    financingFilter !== "all",
    createdFilter !== "all",
    submittedFilter !== "all",
    customerFilter !== "all",
  ].filter(Boolean).length;
  const hasFilters = search !== "" || filterCount > 0;

  /** Date range label when filter active. e.g. "4 Mar 2026 – 11 Mar 2026" */
  function getDateRangeLabel(filter: string): string | null {
    if (filter === "all") return null;
    const now = new Date();
    const start = new Date(now);
    if (filter === "7d") start.setDate(now.getDate() - 7);
    else if (filter === "30d") start.setDate(now.getDate() - 30);
    else if (filter === "90d") start.setDate(now.getDate() - 90);
    return `${formatDate(start)} – ${formatDate(now)}`;
  }
  const submittedRangeLabel = getDateRangeLabel(submittedFilter);
  const totalPages = Math.ceil(filteredApplications.length / perPage) || 1;
  const startIndex = (page - 1) * perPage + 1;
  const endIndex = Math.min(
    page * perPage,
    filteredApplications.length
  );

  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(
    () => createApiClient(undefined, getAccessToken),
    [getAccessToken]
  );

  /** Document download: fetches presigned URL from API, opens in new tab.
      Errors (network, API failure, missing URL) show toast. */
  const handleDocumentDownload = async (s3Key: string) => {
    try {
      const resp = await apiClient.getS3DownloadUrl(s3Key);
      if (!resp.success || !resp.data?.downloadUrl) {
        toast.error("Could not get download link");
        return;
      }
      window.open(resp.data.downloadUrl, "_blank");
    } catch {
      toast.error("Could not get download link");
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back, there!
          </h2>
          <p className="text-[17px] leading-7 text-muted-foreground mt-1">
            Manage your loan applications from this dashboard.
          </p>
        </div>
        <Button
          asChild
          className="gap-2 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
        >
          <Link href="/applications/new">
            <PlusIcon className="h-4 w-4" />
            Apply for financing
          </Link>
        </Button>
      </section>

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 px-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl font-bold">Applications</CardTitle>
            <Badge
              variant="secondary"
              className="rounded-full bg-muted text-muted-foreground font-normal hover:bg-muted"
            >
              {filteredApplications.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 space-y-6">
          {/* FILTER: Same pattern as ActivityToolbar — search + FunnelIcon dropdowns + Clear + count. */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
            <div className="relative flex-1 w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Application ID, customer, or invoice number"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0"
                  >
                    <FunnelIcon className="h-4 w-4" />
                    Date
                    {(createdFilter !== "all" || submittedFilter !== "all") && (
                      <Badge
                        variant="default"
                        className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none"
                      >
                        {(createdFilter !== "all" ? 1 : 0) + (submittedFilter !== "all" ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1">
                  <DropdownMenuLabel>Application created</DropdownMenuLabel>
                  {[
                    { value: "all", label: "All time" },
                    { value: "7d", label: "Last 7 days" },
                    { value: "30d", label: "Last 30 days" },
                    { value: "90d", label: "Last 90 days" },
                  ].map((opt) => (
                    <DropdownMenuItem
                      key={`created-${opt.value}`}
                      className="pl-8 relative"
                      onClick={() => {
                        setCreatedFilter(opt.value);
                        setPage(1);
                      }}
                    >
                      {createdFilter === opt.value && (
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-foreground" />
                        </span>
                      )}
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Application submitted</DropdownMenuLabel>
                  {[
                    { value: "all", label: "All time" },
                    { value: "7d", label: "Last 7 days" },
                    { value: "30d", label: "Last 30 days" },
                    { value: "90d", label: "Last 90 days" },
                  ].map((opt) => (
                    <DropdownMenuItem
                      key={`sub-${opt.value}`}
                      className="pl-8 relative"
                      onClick={() => {
                        setSubmittedFilter(opt.value);
                        setPage(1);
                      }}
                    >
                      {submittedFilter === opt.value && (
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-foreground" />
                        </span>
                      )}
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0"
                  >
                    <FunnelIcon className="h-4 w-4" />
                    Filter
                    {filterCount > 0 && (
                      <Badge
                        variant="default"
                        className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none"
                      >
                        {filterCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1">
                  <DropdownMenuLabel>Application status</DropdownMenuLabel>
                  {[
                    { value: "all", label: "All" },
                    ...FILTER_STATUSES.map((key) => ({ value: key, label: STATUS[key]?.label ?? key })),
                  ].map((opt) => (
                    <DropdownMenuItem
                      key={`status-${opt.value}`}
                      className="pl-8 relative"
                      onClick={() => {
                        setStatusFilter(opt.value);
                        setPage(1);
                      }}
                    >
                      {statusFilter === opt.value && (
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-foreground" />
                        </span>
                      )}
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Financing structure</DropdownMenuLabel>
                  {[
                    { value: "all", label: "All" },
                    ...FINANCING_TYPES.map(({ value, label }) => ({ value, label })),
                  ].map((opt) => (
                    <DropdownMenuItem
                      key={`fin-${opt.value}`}
                      className="pl-8 relative"
                      onClick={() => {
                        setFinancingFilter(opt.value);
                        setPage(1);
                      }}
                    >
                      {financingFilter === opt.value && (
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-foreground" />
                        </span>
                      )}
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Customer</DropdownMenuLabel>
                  {[
                    { value: "all", label: "All" },
                    ...uniqueCustomers.map((c) => ({ value: c, label: c })),
                  ].map((opt) => (
                    <DropdownMenuItem
                      key={`cust-${opt.value}`}
                      className="pl-8 relative"
                      onClick={() => {
                        setCustomerFilter(opt.value);
                        setPage(1);
                      }}
                    >
                      {customerFilter === opt.value && (
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-foreground" />
                        </span>
                      )}
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setFinancingFilter("all");
                    setCreatedFilter("all");
                    setSubmittedFilter("all");
                    setCustomerFilter("all");
                    setPage(1);
                  }}
                  className="gap-2 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0"
                >
                  <XMarkIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}

              {submittedRangeLabel && (
                <span className="text-sm text-muted-foreground">
                  Submitted: {submittedRangeLabel}
                </span>
              )}

              <Badge
                variant="outline"
                className="h-11 px-4 rounded-xl text-sm font-normal bg-muted/30 border-none whitespace-nowrap text-muted-foreground hover:bg-muted/30"
              >
                {hasFilters ? (
                  <>
                    {filteredApplications.length} of {totalCount} applications
                  </>
                ) : (
                  <>
                    {filteredApplications.length}{" "}
                    {filteredApplications.length === 1 ? "application" : "applications"}
                  </>
                )}
              </Badge>
            </div>
          </div>

          {/* Application cards */}
          <div className="rounded-xl border bg-muted/30 p-6">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                Loading applications…
              </div>
            ) : paginatedApplications.length > 0 ? (
              <div className="space-y-4">
                {paginatedApplications.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    onDocumentDownload={handleDocumentDownload}
                    onReviewContractOffer={openReviewContractOffer}
                    onReviewInvoiceOffer={openReviewInvoiceOffer}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                {totalCount === 0
                  ? "No applications yet."
                  : "No applications match your filters."}
              </div>
            )}

            {filteredApplications.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows per page:</span>
                    <Select
                      value={String(perPage)}
                      onValueChange={(v) => {
                        setPerPage(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 w-16 rounded-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PER_PAGE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Showing {startIndex}-{endIndex} of {filteredApplications.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page === totalPages}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ReviewOfferModal
        type={offerType}
        record={offerType === "invoice" ? selectedInvoice : undefined}
        contractId={offerType === "contract" ? selectedContractId ?? undefined : undefined}
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
      />
    </div>
  );
}
