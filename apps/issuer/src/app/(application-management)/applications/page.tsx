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
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS, FILTER_STATUSES, FINANCING_TYPES } from "./status";
import { useApplicationsData } from "./use-applications-data";
import { ReviewOfferModal } from "./components/ReviewOfferModal";
import { useCancelApplication, useWithdrawInvoice, useDeleteDraftApplication } from "@/hooks/use-applications";
import { generateMockApplications } from "@/dev/mockApplications";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { NormalizedApplication, NormalizedInvoice } from "./status";

const SKELETON_COUNT = 8;
const MOCK_APPLICATION_COUNT = 10;

const BADGE_BASE = "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border";
const BADGE_FALLBACK = "border-slate-500/30 bg-slate-500/10 text-slate-600";

/** Resolves badge key for withdrawn: OFFER_EXPIRED uses amber, else slate. */
function resolveBadgeKey(badgeKey: string, withdrawReason?: "USER_CANCELLED" | "OFFER_EXPIRED"): string {
  if (badgeKey === "withdrawn" && withdrawReason === "OFFER_EXPIRED") return "withdrawn_offer_expired";
  return badgeKey;
}

/** Skeleton that matches ApplicationCard layout. */
function ApplicationCardSkeleton() {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm md:shadow">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap justify-between gap-6">
          <div className="space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="space-y-4 text-right">
            <Skeleton className="h-5 w-28 ml-auto" />
            <Skeleton className="h-5 w-24 ml-auto" />
            <Skeleton className="h-5 w-32 ml-auto" />
          </div>
        </div>
        <div className="flex justify-center pt-1">
          <Skeleton className="h-5 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  badgeKey,
  withdrawReason,
}: {
  badgeKey: string;
  withdrawReason?: "USER_CANCELLED" | "OFFER_EXPIRED";
}) {
  const resolved = resolveBadgeKey(badgeKey, withdrawReason);
  const s = STATUS[resolved];
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
  onCancelApplication,
  onDeleteDraft,
  onWithdrawInvoice,
  isCancelApplicationPending,
  isWithdrawInvoicePending,
}: {
  application: NormalizedApplication;
  onDocumentDownload: (s3Key: string) => Promise<void>;
  onReviewContractOffer?: (contractId: string) => void;
  onReviewInvoiceOffer?: (invoice: NormalizedInvoice) => void;
  onCancelApplication?: (applicationId: string) => void;
  onDeleteDraft?: (applicationId: string) => void;
  onWithdrawInvoice?: (invoiceId: string, applicationId: string, organizationId?: string) => void;
  isCancelApplicationPending?: boolean;
  isWithdrawInvoicePending?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const { cardStatus } = application;
  const isDraft = application.status === "draft";
  const isGenericDraft = application.type === "Generic";
  const hasContract = application.type === "Contract financing";

  const useDraftCardLayout = isDraft && isGenericDraft;

  const displayId = "#" + application.id.slice(-8);
  const showFinancingLabel = !isGenericDraft;

  return (
    <>
      <Card className="rounded-2xl border bg-card shadow-sm md:shadow">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">
                Application ID {displayId}
                {showFinancingLabel
                  ? ` - ${application.type
                      .split(" ")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                      .join(" ")}`
                  : ""}
              </span>
              <StatusBadge
                badgeKey={cardStatus.badgeKey}
                withdrawReason={cardStatus.badgeKey === "withdrawn" ? application.withdrawReason : undefined}
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Make Amendments: only for Action Required (AMENDMENT_REQUESTED). Links to /edit amendment flow. */}
              {cardStatus.showMakeAmendments && (
                <Button size="sm" variant="makeAmendments" className="rounded-xl" asChild>
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
                      type="button"
                      size="sm"
                      variant="reviewOffer"
                      className="rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReviewContractOffer(application.contractId!);
                      }}
                    >
                      Review Contract Financing Offer
                    </Button>
                  );
                }
                if (invoiceLink && onReviewInvoiceOffer) {
                  return (
                    <Button
                      type="button"
                      size="sm"
                      variant="reviewOffer"
                      className="rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReviewInvoiceOffer(invoiceLink);
                      }}
                    >
                      Review Invoice Financing Offer
                    </Button>
                  );
                }
                return (
                  <Button size="sm" variant="reviewOffer" className="rounded-xl" disabled>
                    Review Invoice Financing Offer
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
                        className="cursor-pointer"
                        onClick={() => onDeleteDraft?.(application.id)}
                      >
                        Delete Draft
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={isCancelApplicationPending}
                      onClick={() => {
                        if (!isCancelApplicationPending && onCancelApplication) {
                          onCancelApplication(application.id);
                        }
                      }}
                    >
                      {isCancelApplicationPending ? "Withdrawing..." : "Withdraw Application"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {useDraftCardLayout ? (
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
                Submitted:{" "}
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
              <div className="overflow-hidden rounded-xl border">
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
                      const showReviewOffer = invStatus === "OFFER_SENT" && inv.offerStatus === "Offer received";
                      const canReview = inv.canReviewOffer;
                      const showMakeAmendments =
                        application.cardStatus.showMakeAmendments && invStatus === "AMENDMENT_REQUESTED";
                      const canWithdrawInvoice = !["APPROVED", "REJECTED", "WITHDRAWN"].includes(invStatus);
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
                            <div className="flex items-start justify-end gap-2">
                              {(showReviewOffer || showMakeAmendments) && (
                                <div className="flex flex-col items-center gap-1 min-w-[140px]">
                                  {showReviewOffer && (
                                    canReview && onReviewInvoiceOffer ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="reviewOffer"
                                        className="h-8 w-full min-w-[140px] text-xs font-medium rounded-xl"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onReviewInvoiceOffer(inv);
                                        }}
                                      >
                                        Review Offer
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="reviewOffer"
                                        className="h-8 w-full min-w-[140px] text-xs font-medium rounded-xl"
                                        disabled
                                      >
                                        Review Offer
                                      </Button>
                                    )
                                  )}
                                  {showMakeAmendments && (
                                    <Button
                                      size="sm"
                                      variant="makeAmendments"
                                      className="h-8 w-full min-w-[140px] text-xs font-medium rounded-xl"
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
                                    disabled={!canWithdrawInvoice || isWithdrawInvoicePending}
                                    onClick={() => {
                                      if (canWithdrawInvoice && !isWithdrawInvoicePending && onWithdrawInvoice) {
                                        onWithdrawInvoice(inv.id, application.id, application.issuerOrganizationId);
                                      }
                                    }}
                                    title={
                                      !canWithdrawInvoice
                                        ? "Cannot withdraw: invoice is already approved, rejected, or withdrawn"
                                        : isWithdrawInvoicePending
                                          ? "Withdrawal in progress"
                                          : undefined
                                    }
                                  >
                                    {isWithdrawInvoicePending ? "Withdrawing..." : "Withdraw Invoice"}
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
  const [debugShowSkeleton, setDebugShowSkeleton] = React.useState(false);
  const [debugMockApplications, setDebugMockApplications] = React.useState<NormalizedApplication[] | null>(null);

  const { applications, isLoading } = useApplicationsData({
    debugShowSkeleton,
    debugMockApplications,
  });

  const cancelApplication = useCancelApplication();
  const withdrawInvoice = useWithdrawInvoice();
  const deleteDraftApplication = useDeleteDraftApplication();

  const [deleteDraftDialogOpen, setDeleteDraftDialogOpen] = React.useState(false);
  const [deleteDraftApplicationId, setDeleteDraftApplicationId] = React.useState<string | null>(null);

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
    setOfferType("invoice");
    setSelectedContractId(null);
    setSelectedInvoice(invoice);
    setReviewModalOpen(true);
  }, []);

  const handleCancelApplication = React.useCallback(
    async (applicationId: string) => {
      try {
        await cancelApplication.mutateAsync(applicationId);
      } catch {
        // toast handled by mutation onError
      }
    },
    [cancelApplication]
  );

  const handleWithdrawInvoice = React.useCallback(
    async (invoiceId: string, applicationId: string, organizationId?: string) => {
      try {
        await withdrawInvoice.mutateAsync({ invoiceId, applicationId, organizationId });
      } catch {
        // toast handled by mutation onError
      }
    },
    [withdrawInvoice]
  );

  /** Defer dialog open to next tick so dropdown fully closes first; avoids flash/double-open. */
  const handleDeleteDraftClick = React.useCallback((applicationId: string) => {
    const id = applicationId;
    queueMicrotask(() => {
      setDeleteDraftApplicationId(id);
      setDeleteDraftDialogOpen(true);
    });
  }, []);

  const handleDeleteDraftConfirm = React.useCallback(async () => {
    if (!deleteDraftApplicationId) return;
    try {
      await deleteDraftApplication.mutateAsync(deleteDraftApplicationId);
      toast.success("Draft application deleted");
      setDeleteDraftDialogOpen(false);
      setDeleteDraftApplicationId(null);
    } catch {
      // toast handled by mutation onError
    }
  }, [deleteDraftApplicationId, deleteDraftApplication]);

  const handleDebugSkeleton = React.useCallback(() => {
    setDebugShowSkeleton((prev) => !prev);
    if (!debugShowSkeleton) setDebugMockApplications(null);
  }, [debugShowSkeleton]);

  const handleDebugMockCards = React.useCallback(() => {
    setDebugMockApplications(generateMockApplications(MOCK_APPLICATION_COUNT));
    setDebugShowSkeleton(false);
  }, []);

  const handleDebugReset = React.useCallback(() => {
    setDebugShowSkeleton(false);
    setDebugMockApplications(null);
  }, []);

  /* --- FILTER: state. Status, Financing, Submitted date, Withdraw reason, Offer expiry, Search. --- */
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [financingFilter, setFinancingFilter] = React.useState("all");
  const [submittedFilter, setSubmittedFilter] = React.useState("all");
  const [offerExpiryFilter, setOfferExpiryFilter] = React.useState("all");
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
    if (offerExpiryFilter !== "all") {
      const now = new Date();
      const days = offerExpiryFilter === "3d" ? 3 : offerExpiryFilter === "7d" ? 7 : 14;
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() + days);
      const nowTime = now.getTime();
      const cutoffTime = cutoff.getTime();
      list = list.filter((a) => {
        if (!a.expiresAt) return false;
        const exp = new Date(a.expiresAt).getTime();
        return exp > nowTime && exp <= cutoffTime;
      });
    }
    return list;
  }, [applications, search, statusFilter, financingFilter, submittedFilter, offerExpiryFilter]);

  const paginatedApplications = filteredApplications.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const totalCount = applications.length;
  const statusMoreFilterCount = [
    statusFilter !== "all",
    financingFilter !== "all",
    offerExpiryFilter !== "all",
  ].filter(Boolean).length;
  const hasFilters =
    search !== "" ||
    submittedFilter !== "all" ||
    statusMoreFilterCount > 0;
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

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {isDev && (
        <Card
          className="fixed bottom-5 right-5 z-[9999] w-[200px] shadow-lg border-2 border-amber-500/50"
          data-testid="applications-debug-panel"
        >
          <CardHeader className="py-2 px-3">
            <h3 className="text-sm font-semibold">Debug Panel</h3>
          </CardHeader>
          <Separator />
          <CardContent className="py-2 px-3 space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-8"
              onClick={handleDebugSkeleton}
            >
              {debugShowSkeleton ? "Hide Skeleton" : "Debug Skeleton"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-8"
              onClick={handleDebugMockCards}
            >
              Debug Mock Cards
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-8"
              onClick={handleDebugReset}
            >
              Reset Debug
            </Button>
          </CardContent>
        </Card>
      )}

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
          {/* FILTER: Matches ActivityToolbar — search + 2 dropdowns (Submitted, Filter) + Clear + count. */}
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0"
                  >
                    <FunnelIcon className="h-4 w-4" />
                    Submitted
                    {submittedFilter !== "all" && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none"
                      >
                        1
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1">
                  <DropdownMenuLabel>Submitted</DropdownMenuLabel>
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
                    {statusMoreFilterCount > 0 && (
                      <Badge
                        variant="default"
                        className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none"
                      >
                        {statusMoreFilterCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-0">
                  <div className="p-1">
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
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
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <DropdownMenuLabel>Financing</DropdownMenuLabel>
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
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <DropdownMenuLabel>Offer expiring</DropdownMenuLabel>
                    {[
                      { value: "all", label: "All" },
                      { value: "3d", label: "Within 3 days" },
                      { value: "7d", label: "Within 7 days" },
                      { value: "14d", label: "Within 14 days" },
                    ].map((opt) => (
                      <DropdownMenuItem
                        key={`expiry-${opt.value}`}
                        className="pl-8 relative"
                        onClick={() => {
                          setOfferExpiryFilter(opt.value);
                          setPage(1);
                        }}
                      >
                        {offerExpiryFilter === opt.value && (
                          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-foreground" />
                          </span>
                        )}
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setFinancingFilter("all");
                    setSubmittedFilter("all");
                    setOfferExpiryFilter("all");
                    setPage(1);
                  }}
                  className="gap-2 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0"
                >
                  <XMarkIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
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
              <div className="space-y-4">
                {Array.from({ length: debugShowSkeleton ? SKELETON_COUNT : perPage }).map((_, i) => (
                  <ApplicationCardSkeleton key={i} />
                ))}
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
                    onCancelApplication={handleCancelApplication}
                    onDeleteDraft={handleDeleteDraftClick}
                    onWithdrawInvoice={handleWithdrawInvoice}
                    isCancelApplicationPending={cancelApplication.isPending}
                    isWithdrawInvoicePending={withdrawInvoice.isPending}
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

      <ConfirmDialog
        open={deleteDraftDialogOpen}
        onOpenChange={(open) => {
          setDeleteDraftDialogOpen(open);
          if (!open) setDeleteDraftApplicationId(null);
        }}
        title="Delete draft?"
        description="Are you sure you want to delete this draft? This cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteDraftConfirm}
        isLoading={deleteDraftApplication.isPending}
      />

      {reviewModalOpen && (
        <ReviewOfferModal
          type={offerType}
          record={offerType === "invoice" ? selectedInvoice : undefined}
          contractId={offerType === "contract" ? selectedContractId ?? undefined : undefined}
          onClose={() => setReviewModalOpen(false)}
        />
      )}
    </div>
  );
}
