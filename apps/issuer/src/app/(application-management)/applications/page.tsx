"use client";

/**
 * Applications Dashboard — main screen listing application cards.
 *
 * Data: useApplicationsData() returns NormalizedApplication[] (from API via adapter or mock).
 * Renders: card per app with badge (from STATUS_BADGES), buttons (from cardStatus), invoice table.
 * Status logic lives in adapter + lib; this page only displays.
 */

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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { STATUS_BADGES, STATUS_BADGE_COLORS } from "./applications.config";

/** Status values for filter dropdown. Must match application.status (cardStatus.badgeKey). */
const STATUS_FILTER_VALUES = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  PENDING_AMENDMENT: "pending_amendment",
  SENT: "sent",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
} as const;
import { useApplicationsData } from "./use-applications-data";
import type { NormalizedApplication, NormalizedInvoice } from "./adapters/application.adapter";

/* Renders status badge. badgeKey from cardStatus maps to label and color in applications.config. */

const BADGE_BASE = "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border";
const BADGE_FALLBACK = "border-slate-500/30 bg-slate-500/10 text-slate-600";

function StatusBadge({ badgeKey }: { badgeKey: string }) {
  const config = STATUS_BADGES[badgeKey] ?? { label: badgeKey, tone: "neutral" as const };
  const label = config.label;
  const colorClass = STATUS_BADGE_COLORS[badgeKey] ?? BADGE_FALLBACK;
  return (
    <span className={cn(BADGE_BASE, colorClass)}>
      {label}
    </span>
  );
}

/* ============================================================
   DOCUMENT DOWNLOAD LINK
   Props from NormalizedInvoice (document, documentS3Key from details.document).
   Click icon calls getS3DownloadUrl(s3Key), then opens presigned URL. Errors via toast.
   Disabled when invoices locked (no S3 key or contract not approved).
   ============================================================ */

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
  /* No documentS3Key or invoices locked: show filename only, muted. No download. */
  if (!documentS3Key || disabled) {
    return <span className="text-[15px] text-muted-foreground">{documentName}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[15px]">
      <span>{documentName}</span>
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

/* Shown when cardStatus is sent but offer has expired (hasExpiredOffer from adapter). */

function OfferExpiredBadge() {
  const colorClass = STATUS_BADGE_COLORS.offer_expired ?? BADGE_FALLBACK;
  return (
    <span className={cn(BADGE_BASE, colorClass)}>
      Offer expired
    </span>
  );
}


/* Renders one card. Props: NormalizedApplication from useApplicationsData. Draft without financing_structure uses minimal layout. */

function ApplicationCard({
  application,
  onWithdraw,
  onDocumentDownload,
}: {
  application: NormalizedApplication;
  onWithdraw: () => void;
  onDocumentDownload: (s3Key: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);

  const { cardStatus } = application;
  const isDraft = application.status === "draft";
  const isGenericDraft = application.type === "Generic";
  const hasContract = application.type === "Contract financing";

  /* Contract financing: lock invoice section until contractStatus === APPROVED. Invoice-only apps have no contract. */
  const invoicesDisabled = hasContract && application.contractStatus !== "APPROVED";

  /* Single badge: sent+expired shows Offer expired; otherwise use cardStatus. */
  const badgeKey =
    cardStatus.badgeKey === "sent" && application.hasExpiredOffer
      ? "offer_expired"
      : cardStatus.badgeKey;

  /* If the application is a draft but already has a financing structure, we render the normal
   * financing card so the user can preview the structure. Only drafts without financing
   * structure use the generic draft card. */
  const useDraftCardLayout = isDraft && isGenericDraft;

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    await new Promise((r) => setTimeout(r, 500));
    onWithdraw();
    setIsWithdrawing(false);
    setWithdrawDialogOpen(false);
  };

  /* We only display the last 8 characters of the application ID to keep the UI cleaner and easier to scan. */
  const displayId = application.id.slice(-8);

  /* If financing_structure is null, this is an incomplete draft. We do not show a financing label yet. */
  const showFinancingLabel = !isGenericDraft;

  return (
    <>
      <Card className="rounded-2xl border bg-card shadow-sm md:shadow">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">
                Application ID {displayId}
                {showFinancingLabel ? ` — ${application.type}` : ""}
              </span>
              {badgeKey === "offer_expired" ? (
                <OfferExpiredBadge />
              ) : (
                <StatusBadge badgeKey={badgeKey} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Contract offer: "Review Contract Financing Offer". Invoice: "Review Offer". Expiry under button. */}
              {cardStatus.showReviewOffer && !application.hasExpiredOffer && (
                <div className="flex flex-col items-center gap-1">
                  <Button
                    size="sm"
                    className="rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                  >
                    {hasContract ? "Review Contract Financing Offer" : "Review Offer"}
                  </Button>
                  {application.offerExpiresAt && (
                    <span className="text-[10px] text-muted-foreground text-center">
                      Offer valid until:{" "}
                      <span className="font-semibold">
                        {format(new Date(application.offerExpiresAt), "dd MMM yyyy")}
                      </span>
                    </span>
                  )}
                </div>
              )}
              {cardStatus.showMakeAmendments && (
                <Button size="sm" className="rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-sm" asChild>
                  <Link href={`/applications/edit/${application.id}`}>
                    Make Amendments
                  </Link>
                </Button>
              )}
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
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onClick={() => setWithdrawDialogOpen(true)}
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
            /* Draft card body: helper text only. No invoice table or contract summary. */
            <p className="text-sm leading-6 text-muted-foreground">
              This application is still being set up.
            </p>
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
                Application date:{" "}
                <span className="text-foreground">
                  {application.applicationDate}
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
              {/* Locked: overlay, disabled actions, helper message. Card header and contract summary stay interactive. */}
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
                      const isExpired = inv.offerStatus === "Offer expired";
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
                            {inv.maturityDate
                              ? format(new Date(inv.maturityDate), "dd MMM yyyy")
                              : "—"}
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
                              {/* Fixed min-width for alignment. Expiry below button to avoid layout shift. */}
                              {(showReviewOffer || showMakeAmendments) && (
                                <div className="flex flex-col items-center gap-1 min-w-[140px]">
                                  {showReviewOffer && (
                                    <>
                                      <Button
                                        size="sm"
                                        className="h-8 w-full min-w-[140px] rounded-xl text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                                        disabled={invDisabled || isExpired || !canReview}
                                      >
                                        Review Offer
                                      </Button>
                                      {inv.offerExpiresAt && (
                                        <span className="text-[10px] text-muted-foreground text-center">
                                          Offer valid until:{" "}
                                          <span className="font-semibold">
                                            {format(new Date(inv.offerExpiresAt), "dd MMM yyyy")}
                                          </span>
                                        </span>
                                      )}
                                    </>
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
                                <DropdownMenuContent
                                  align="end"
                                  className="rounded-xl"
                                >
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    disabled
                                  >
                                    View document
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

      <Dialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Withdraw Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw this application?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawDialogOpen(false)}
              disabled={isWithdrawing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdraw}
              disabled={isWithdrawing}
            >
              {isWithdrawing ? "Withdrawing…" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================
   Uses useApplicationsData and renders cards with filters and pagination. */

const PER_PAGE_OPTIONS = [4, 8, 12] as const;

export default function ApplicationsPage() {
  const { setTitle } = useHeader();
  const { applications, isLoading } = useApplicationsData();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [customerFilter, setCustomerFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(4);
  const [withdrawnIds, setWithdrawnIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setTitle("Applications");
  }, [setTitle]);

  const visibleApplications = React.useMemo(
    () => applications.filter((a) => !withdrawnIds.has(a.id)),
    [applications, withdrawnIds]
  );

  const filteredApplications = React.useMemo(() => {
    let list = [...visibleApplications];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.customer.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (customerFilter !== "all") {
      list = list.filter((a) => a.customer === customerFilter);
    }
    return list;
  }, [visibleApplications, search, statusFilter, customerFilter]);

  const uniqueCustomers = React.useMemo(
    () => [...new Set(visibleApplications.map((a) => a.customer))],
    [visibleApplications]
  );

  const paginatedApplications = filteredApplications.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const totalCount = visibleApplications.length;
  const activeFilterCount = [
    statusFilter !== "all",
    customerFilter !== "all",
    dateFilter !== "all",
  ].filter(Boolean).length;
  const hasFilters = search !== "" || activeFilterCount > 0;
  const totalPages = Math.ceil(filteredApplications.length / perPage) || 1;
  const startIndex = (page - 1) * perPage + 1;
  const endIndex = Math.min(
    page * perPage,
    filteredApplications.length
  );

  const handleWithdraw = (id: string) => {
    setWithdrawnIds((prev) => new Set(prev).add(id));
    if (page > 1 && paginatedApplications.length <= 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  };

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
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary text-primary-foreground"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All statuses
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={STATUS_FILTER_VALUES.DRAFT}>
                    {STATUS_BADGES.draft?.label ?? "Draft"}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={STATUS_FILTER_VALUES.SUBMITTED}>
                    {STATUS_BADGES.submitted?.label ?? "Submitted"}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={STATUS_FILTER_VALUES.UNDER_REVIEW}>
                    {STATUS_BADGES.under_review?.label ?? "Under Review"}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={STATUS_FILTER_VALUES.PENDING_AMENDMENT}>
                    {STATUS_BADGES.pending_amendment?.label ?? "Action Required"}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={STATUS_FILTER_VALUES.SENT}>
                    {STATUS_BADGES.sent?.label ?? "Offer Received"}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={STATUS_FILTER_VALUES.ACCEPTED}>
                    {STATUS_BADGES.accepted?.label ?? "Approved"}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={STATUS_FILTER_VALUES.REJECTED}>
                    {STATUS_BADGES.rejected?.label ?? "Rejected"}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={STATUS_FILTER_VALUES.WITHDRAWN}>
                    {STATUS_BADGES.withdrawn?.label ?? "Withdrawn"}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Customer</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={customerFilter}
                  onValueChange={(v) => {
                    setCustomerFilter(v);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All customers
                  </DropdownMenuRadioItem>
                  {uniqueCustomers.map((c) => (
                    <DropdownMenuRadioItem key={c} value={c}>
                      {c}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={dateFilter}
                  onValueChange={(v) => {
                    setDateFilter(v);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All time
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30d">
                    Last 30 days
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="90d">
                    Last 90 days
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                {hasFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                        setCustomerFilter("all");
                        setDateFilter("all");
                        setPage(1);
                      }}
                      className="gap-2 text-muted-foreground"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      Clear filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Badge
              variant="outline"
              className="h-11 px-4 rounded-xl text-sm font-normal bg-muted/30 border-none whitespace-nowrap text-muted-foreground hover:bg-muted/30"
            >
              {filteredApplications.length}{" "}
              {filteredApplications.length === 1 ? "application" : "applications"}
              {hasFilters ? ` of ${totalCount}` : ""}
            </Badge>
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
                    onWithdraw={() => handleWithdraw(app.id)}
                    onDocumentDownload={handleDocumentDownload}
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
    </div>
  );
}
