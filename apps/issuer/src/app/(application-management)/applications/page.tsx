"use client";

/** Applications dashboard. Data from useApplicationsData. Status config in status.ts. */

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
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
import { formatCurrency, createApiClient, useOrganization } from "@cashsouk/config";
import { WithdrawReason, formatWithdrawLabel } from "@cashsouk/types";
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
import { STATUS, FILTER_STATUSES, FINANCING_TYPES, API_STATUS_TO_BADGE_KEY } from "./status";
import { useApplicationsData } from "./use-applications-data";
import { ReviewOfferModal } from "./components/ReviewOfferModal";
import { useCancelApplication, useWithdrawInvoice, useDeleteDraftApplication } from "@/hooks/use-applications";
import { generateMockApplications } from "@/dev/mockApplications";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileDisplayBadge } from "@/app/(application-flow)/applications/components/file-display-badge";
import type { NormalizedApplication, NormalizedInvoice } from "./status";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SKELETON_COUNT = 8;
const MOCK_APPLICATION_COUNT = 10;

const BADGE_BASE = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border whitespace-nowrap";
const BADGE_FALLBACK = "border-slate-500/30 bg-slate-500/10 text-slate-600";

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
  withdrawReason?: WithdrawReason;
}) {
  const s = STATUS[badgeKey];
  const label =
    badgeKey === "withdrawn" && withdrawReason
      ? formatWithdrawLabel(withdrawReason)
      : (s?.label ?? badgeKey);
  return (
    <span className={cn(BADGE_BASE, s?.color ?? BADGE_FALLBACK)}>
      {label}
    </span>
  );
}

/** Single date display format used across the page. e.g. "10 Mar 2026" */
function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return "—";
  return format(new Date(date), "d MMM yyyy");
}

function formatDateTime(date: string | Date | null | undefined): string {
  if (date == null) return "—";
  return format(new Date(date), "dd MMM yyyy, h:mm a");
}

/** Invoice table document cell: invoice file badge + download. */
function InvoiceDocumentCell({
  documentName,
  documentS3Key,
  onDownload,
}: {
  documentName: string;
  documentS3Key: string | null;
  onDownload: (s3Key: string) => Promise<void>;
}) {
  const [loading, setLoading] = React.useState(false);
  const hasDocument = documentName && documentName !== "—";
  if (!hasDocument) {
    return <span className="text-[15px] text-muted-foreground">—</span>;
  }
  return (
    <FileDisplayBadge
      fileName={documentName}
      size="sm"
      truncate
      className="min-w-0 bg-background"
      trailing={
        documentS3Key ? (
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
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
            aria-label={`Download ${documentName}`}
          >
            <ArrowDownTrayIcon className="h-3 w-3" />
          </button>
        ) : undefined
      }
    />
  );
}

function ApplicationCard({
  application,
  onDocumentDownload,
  onViewSignedContractOffer,
  onViewSignedInvoiceOffer,
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
  onViewSignedContractOffer?: (signedOfferLetterS3Key: string) => Promise<void>;
  onViewSignedInvoiceOffer?: (signedOfferLetterS3Key: string) => Promise<void>;
  onReviewContractOffer?: (applicationId: string, contractId: string) => void;
  onReviewInvoiceOffer?: (applicationId: string, invoice: NormalizedInvoice) => void;
  onCancelApplication?: (applicationId: string) => void;
  onDeleteDraft?: (applicationId: string) => void;
  onWithdrawInvoice?: (invoiceId: string, applicationId: string, organizationId?: string) => void;
  isCancelApplicationPending?: boolean;
  isWithdrawInvoicePending?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(application.status === "offer_sent");

  const { cardStatus } = application;
  const isDraft = application.status === "draft";
  const isGenericDraft = application.type === "Generic";
  const hasContract = application.type === "Contract financing";

  const useDraftCardLayout = isDraft && isGenericDraft;

  const displayId = "#" + application.id.slice(-8).toUpperCase();
  const showFinancingLabel = !isGenericDraft;

  return (
    <>
      <Card className="rounded-2xl border bg-card shadow-sm md:shadow">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold">
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
              <div className="flex flex-wrap items-center gap-2 justify-end">
              {cardStatus.showReviewOffer &&
                hasContract &&
                application.contractId &&
                application.contractStatus === "OFFER_SENT" &&
                onReviewContractOffer && (
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="reviewOffer"
                      className="rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReviewContractOffer(application.id, application.contractId!);
                      }}
                    >
                      Review Contract Financing Offer
                    </Button>
                    {application.expiresAt && (
                      <span className="text-xs text-muted-foreground">
                        Offer valid until: {format(new Date(application.expiresAt), "d MMM yyyy")}
                      </span>
                    )}
                  </div>
                )}
              </div>
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
                    <>
                      {(() => {
                        const showViewSignedContract =
                          application.signedContractOfferLetterAvailable &&
                          !!application.signedContractOfferLetterS3Key &&
                          hasContract &&
                          application.contractId &&
                          onViewSignedContractOffer;
                        const withdrawApplicationDisabled =
                          isCancelApplicationPending ||
                          !!showViewSignedContract;
                        return (
                          <>
                            {showViewSignedContract && (
                              <>
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void onViewSignedContractOffer!(
                                      application.signedContractOfferLetterS3Key!
                                    );
                                  }}
                                >
                                  View Signed Offer
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              className="cursor-pointer"
                              disabled={withdrawApplicationDisabled}
                              onClick={() => {
                                if (!withdrawApplicationDisabled && onCancelApplication) {
                                  onCancelApplication(application.id);
                                }
                              }}
                              title={
                                showViewSignedContract
                                  ? "Withdraw is not available while a signed offer letter is on file"
                                  : undefined
                              }
                            >
                              {isCancelApplicationPending ? "Withdrawing..." : "Withdraw Application"}
                            </DropdownMenuItem>
                          </>
                        );
                      })()}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {useDraftCardLayout ? (
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px] leading-6">
              <p className="text-[15px] leading-6 text-muted-foreground col-span-2">
                This application is still being set up.
              </p>
              <span className="text-muted-foreground">Submitted:</span>
              <span className="text-foreground">{formatDateTime(application.submittedAt)}</span>
            </div>
          ) : (
          <div className="flex flex-wrap justify-between gap-6">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px] leading-6">
              {hasContract && application.contractTitle && (
                <>
                  <span className="text-muted-foreground">Contract title:</span>
                  <span className="text-foreground">{application.contractTitle}</span>
                </>
              )}
              <span className="text-muted-foreground">Customer:</span>
              <span className="text-foreground">{application.customer}</span>
              <span className="text-muted-foreground">Submitted:</span>
              <span className="text-foreground">{formatDateTime(application.submittedAt)}</span>
            </div>
            {hasContract && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px] leading-6">
                <span className="text-muted-foreground">Contract value:</span>
                <span className="text-foreground">
                  {application.contractValue != null
                    ? formatCurrency(application.contractValue)
                    : "—"}
                </span>
                <span className="text-muted-foreground">Contract financing:</span>
                <span className="text-foreground">
                  {application.facilityApplied != null
                    ? formatCurrency(application.facilityApplied)
                    : "—"}
                </span>
                <span className="text-muted-foreground">Approved facility:</span>
                <span className="text-foreground">{application.approvedFacility}</span>
              </div>
            )}
          </div>
          )}
          {!useDraftCardLayout && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              className="text-[15px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Hide details" : "View details"}
            </button>
          </div>
          )}

          {!useDraftCardLayout && expanded && (
            <div className="mt-4 relative">
              <h3 className="text-base font-semibold text-foreground mb-3">
                Invoices
              </h3>
              <div className="border rounded-xl bg-muted/30 overflow-hidden">
                <div className="overflow-x-auto">
              <Table className="table-fixed w-full text-[15px]">
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="w-[105px] min-w-[105px] whitespace-nowrap text-sm font-semibold p-3 text-left">
                      Invoice Number
                    </TableHead>
                    <TableHead className="w-[105px] min-w-[105px] whitespace-nowrap text-sm font-semibold p-3 text-left">
                      Maturity Date
                    </TableHead>
                    <TableHead className="w-[115px] min-w-[115px] whitespace-nowrap text-sm font-semibold p-3 text-right tabular-nums">
                      Invoice Value
                    </TableHead>
                    <TableHead className="w-[115px] min-w-[115px] whitespace-nowrap text-sm font-semibold p-3 text-right tabular-nums">
                      Applied Financing
                    </TableHead>
                    <TableHead className="w-[150px] min-w-[140px] whitespace-nowrap text-sm font-semibold p-3 text-left">
                      Documents
                    </TableHead>
                    <TableHead className="w-[115px] min-w-[115px] whitespace-nowrap text-sm font-semibold p-3 text-right tabular-nums">
                      Financing Offered
                    </TableHead>
                    <TableHead className="w-[95px] min-w-[95px] whitespace-nowrap text-sm font-semibold p-3 text-right tabular-nums">
                      Profit Rate
                    </TableHead>
                    <TableHead className="w-[120px] min-w-[120px] whitespace-nowrap text-sm font-semibold p-3 text-left">
                      Status
                    </TableHead>
                    <TableHead className="w-[180px] min-w-[160px] whitespace-nowrap text-sm font-semibold p-3 text-center">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {application.invoices.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={9}
                        className="text-center py-8 text-[15px] text-muted-foreground"
                      >
                        No invoices available
                      </TableCell>
                    </TableRow>
                  ) : (
                    application.invoices.map((inv: NormalizedInvoice, idx: number) => {
                      const invStatus = String(inv.status ?? "").toUpperCase();
                      const showReviewOffer = invStatus === "OFFER_SENT" && inv.offerStatus === "Offer received";
                      const canReview = inv.canReviewOffer;
                      const showMakeAmendments =
                        application.cardStatus.showMakeAmendments && invStatus === "AMENDMENT_REQUESTED";
                      const canWithdrawInvoice = !["APPROVED", "REJECTED", "WITHDRAWN"].includes(invStatus);
                      return (
                        <TableRow
                          key={inv.id}
                          className={cn(
                            "border-b border-border last:border-b-0 transition-colors hover:bg-muted",
                            idx % 2 === 1 && "bg-muted/40"
                          )}
                        >
                          <TableCell className="p-3 text-[15px] align-middle text-left whitespace-nowrap">
                            {inv.number}
                          </TableCell>
                          <TableCell className="p-3 text-[15px] align-middle text-left">
                            {formatDate(inv.maturityDate)}
                          </TableCell>
                          <TableCell className="p-3 text-[15px] align-middle text-right tabular-nums whitespace-nowrap">
                            {inv.value ? formatCurrency(inv.value) : "—"}
                          </TableCell>
                          <TableCell className="p-3 text-[15px] align-middle text-right tabular-nums whitespace-nowrap">
                            {inv.appliedFinancing != null
                              ? formatCurrency(inv.appliedFinancing)
                              : "—"}
                          </TableCell>
                          <TableCell className="p-3 min-w-0 max-w-[150px] overflow-hidden align-middle text-left">
                            <InvoiceDocumentCell
                              documentName={inv.document}
                              documentS3Key={inv.documentS3Key}
                              onDownload={onDocumentDownload}
                            />
                          </TableCell>
                          <TableCell className="p-3 text-[15px] align-middle text-right tabular-nums whitespace-nowrap">
                            {inv.financingOffered}
                          </TableCell>
                          <TableCell className="p-3 text-[15px] align-middle text-right tabular-nums whitespace-nowrap">
                            {inv.profitRate}
                          </TableCell>
                          <TableCell className="p-3 align-middle text-left whitespace-nowrap">
                            <span className="inline-block">
                              <StatusBadge
                                badgeKey={API_STATUS_TO_BADGE_KEY[String(inv.status).toUpperCase()] ?? inv.status.toLowerCase()}
                              />
                            </span>
                          </TableCell>
                          <TableCell className="p-3 align-top text-center">
                            <div className="flex items-start justify-center gap-2">
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
                                          onReviewInvoiceOffer(application.id, inv);
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
                                  {showReviewOffer && inv.offer_details?.expires_at != null ? (
                                    <span className="text-xs text-muted-foreground">
                                      Offer valid until: {format(new Date(String(inv.offer_details.expires_at)), "d MMM yyyy")}
                                    </span>
                                  ) : null}
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
                                  {(() => {
                                    const showViewSignedInvoice =
                                      !!inv.signedOfferLetterS3Key && onViewSignedInvoiceOffer;
                                    const withdrawInvoiceDisabled =
                                      !canWithdrawInvoice ||
                                      isWithdrawInvoicePending ||
                                      !!showViewSignedInvoice;
                                    return (
                                      <>
                                        {showViewSignedInvoice && (
                                          <>
                                            <DropdownMenuItem
                                              className="cursor-pointer"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void onViewSignedInvoiceOffer!(
                                                  inv.signedOfferLetterS3Key!
                                                );
                                              }}
                                            >
                                              View Signed Offer
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                          </>
                                        )}
                                        <DropdownMenuItem
                                          className="cursor-pointer"
                                          disabled={withdrawInvoiceDisabled}
                                          onClick={() => {
                                            if (
                                              canWithdrawInvoice &&
                                              !isWithdrawInvoicePending &&
                                              !showViewSignedInvoice &&
                                              onWithdrawInvoice
                                            ) {
                                              onWithdrawInvoice(inv.id, application.id, application.issuerOrganizationId);
                                            }
                                          }}
                                          title={
                                            showViewSignedInvoice
                                              ? "Withdraw is not available while a signed offer letter is on file"
                                              : !canWithdrawInvoice
                                                ? "Cannot withdraw: invoice is already approved, rejected, or withdrawn"
                                                : isWithdrawInvoicePending
                                                  ? "Withdrawal in progress"
                                                  : undefined
                                          }
                                        >
                                          {isWithdrawInvoicePending ? "Withdrawing..." : "Withdraw Invoice"}
                                        </DropdownMenuItem>
                                      </>
                                    );
                                  })()}
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

  const [withdrawApplicationDialogOpen, setWithdrawApplicationDialogOpen] = React.useState(false);
  const [withdrawApplicationId, setWithdrawApplicationId] = React.useState<string | null>(null);
  const withdrawDialogScheduledRef = React.useRef(false);

  const [withdrawInvoiceDialogOpen, setWithdrawInvoiceDialogOpen] = React.useState(false);
  const [withdrawInvoicePayload, setWithdrawInvoicePayload] = React.useState<{
    invoiceId: string;
    applicationId: string;
    organizationId?: string;
  } | null>(null);
  const withdrawInvoiceDialogScheduledRef = React.useRef(false);

  /* --- Review offer modal: opens when user clicks Review Offer. --- */
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false);
  const [offerType, setOfferType] = React.useState<"contract" | "invoice">("contract");
  const [selectedApplicationId, setSelectedApplicationId] = React.useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = React.useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = React.useState<NormalizedInvoice | null>(null);

  const openReviewContractOffer = React.useCallback((applicationId: string, contractId: string) => {
    setOfferType("contract");
    setSelectedApplicationId(applicationId);
    setSelectedContractId(contractId);
    setSelectedInvoice(null);
    setReviewModalOpen(true);
  }, []);

  const openReviewInvoiceOffer = React.useCallback((applicationId: string, invoice: NormalizedInvoice) => {
    setOfferType("invoice");
    setSelectedApplicationId(applicationId);
    setSelectedContractId(null);
    setSelectedInvoice(invoice);
    setReviewModalOpen(true);
  }, []);

  const handleWithdrawApplicationClick = React.useCallback((applicationId: string) => {
    if (withdrawDialogScheduledRef.current) return;
    withdrawDialogScheduledRef.current = true;
    setTimeout(() => {
      setWithdrawApplicationId(applicationId);
      setWithdrawApplicationDialogOpen(true);
      withdrawDialogScheduledRef.current = false;
    }, 150);
  }, []);

  const handleWithdrawApplicationConfirm = React.useCallback(async () => {
    const id = withdrawApplicationId;
    if (!id || cancelApplication.isPending) return;
    setWithdrawApplicationId(null);
    try {
      await cancelApplication.mutateAsync(id);
      toast.success("Application withdrawn");
      setWithdrawApplicationDialogOpen(false);
    } catch {
      setWithdrawApplicationId(id);
      // toast handled by mutation onError
    }
  }, [withdrawApplicationId, cancelApplication]);

  const handleWithdrawInvoiceClick = React.useCallback(
    (invoiceId: string, applicationId: string, organizationId?: string) => {
      if (withdrawInvoiceDialogScheduledRef.current) return;
      withdrawInvoiceDialogScheduledRef.current = true;
      setTimeout(() => {
        setWithdrawInvoicePayload({ invoiceId, applicationId, organizationId });
        setWithdrawInvoiceDialogOpen(true);
        withdrawInvoiceDialogScheduledRef.current = false;
      }, 150);
    },
    []
  );

  const handleWithdrawInvoiceConfirm = React.useCallback(async () => {
    const payload = withdrawInvoicePayload;
    if (!payload || withdrawInvoice.isPending) return;
    setWithdrawInvoicePayload(null);
    try {
      await withdrawInvoice.mutateAsync(payload);
      toast.success("Invoice withdrawn");
      setWithdrawInvoiceDialogOpen(false);
    } catch {
      setWithdrawInvoicePayload(payload);
      // toast handled by mutation onError
    }
  }, [withdrawInvoicePayload, withdrawInvoice]);

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
  const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
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
    if (statusFilters.length > 0) {
      list = list.filter((a) => statusFilters.includes(a.status));
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
  }, [applications, search, statusFilters, financingFilter, submittedFilter, offerExpiryFilter]);

  const paginatedApplications = filteredApplications.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const totalCount = applications.length;
  const activeFilterCount =
    (submittedFilter !== "all" ? 1 : 0) +
    statusFilters.length +
    (financingFilter !== "all" ? 1 : 0) +
    (offerExpiryFilter !== "all" ? 1 : 0);
  const hasFilters =
    search !== "" ||
    activeFilterCount > 0;
  const totalPages = Math.ceil(filteredApplications.length / perPage) || 1;
  const startIndex = (page - 1) * perPage + 1;
  const endIndex = Math.min(
    page * perPage,
    filteredApplications.length
  );

  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = React.useMemo(
    () => createApiClient(undefined, getAccessToken),
    [getAccessToken]
  );

  const [signingReturnDialogOpen, setSigningReturnDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signing") !== "complete") return;

    const applicationId = params.get("applicationId");
    const invoiceId = params.get("invoiceId");

    let cancelled = false;
    const run = async () => {
      if (applicationId) {
        try {
          if (invoiceId) {
            await apiClient.finalizeInvoiceOfferSigningAfterReturn(applicationId, invoiceId);
          } else {
            await apiClient.finalizeContractOfferSigningAfterReturn(applicationId);
          }
        } catch {
          if (!cancelled) {
            toast.error(
              "Could not confirm signing with the server. If your offer is still pending, refresh the page or try again shortly."
            );
          }
        }
      }
      if (!cancelled) {
        void queryClient.invalidateQueries({ queryKey: ["applications"] });
        setSigningReturnDialogOpen(true);
        const path = window.location.pathname;
        window.history.replaceState({}, "", path);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [queryClient, apiClient]);

  /** Document download: fetches presigned URL from API, opens in new tab.
      Errors (network, API failure, missing URL) show toast. */
  const handleDocumentDownload = React.useCallback(async (s3Key: string) => {
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
  }, [apiClient]);

  const handleViewSignedContractOffer = React.useCallback(
    async (signedOfferLetterS3Key: string) => {
      await handleDocumentDownload(signedOfferLetterS3Key);
    },
    [handleDocumentDownload]
  );

  const handleViewSignedInvoiceOffer = React.useCallback(
    async (signedOfferLetterS3Key: string) => {
      await handleDocumentDownload(signedOfferLetterS3Key);
    },
    [handleDocumentDownload]
  );

  const isDev = process.env.NODE_ENV === "development";

  const { activeOrganization } = useOrganization();
  const displayName = React.useMemo(() => {
    if (!activeOrganization) return "";
    if (activeOrganization.firstName && activeOrganization.lastName) {
      return `${activeOrganization.firstName} ${activeOrganization.lastName}`;
    }
    if (activeOrganization.type === "COMPANY" && activeOrganization.name) {
      return activeOrganization.name;
    }
    return activeOrganization.type === "PERSONAL" ? "Personal Account" : "Company Account";
  }, [activeOrganization]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-4">
      <div className="p-2 md:p-4">
      {isDev && (
        <Card
          className="fixed bottom-5 right-5 z-[9999] w-[200px] rounded-2xl shadow-lg border-2 border-amber-500/50"
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

      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Welcome back, {displayName}!
          </h2>
          <p className="text-[17px] leading-7 text-muted-foreground mt-1">
            Manage your loan applications from this dashboard.
          </p>
        </div>
        <Button asChild className="gap-2 bg-primary text-primary-foreground shadow-brand hover:opacity-95 h-11 rounded-xl font-semibold shrink-0">
          <Link href="/applications/new">
            <PlusIcon className="h-4 w-4" />
            Get Financed
          </Link>
        </Button>
      </section>

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 px-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight">
              Applications
            </CardTitle>
            <Badge
              variant="secondary"
              className="rounded-full bg-muted text-muted-foreground font-medium px-3 py-1"
            >
              {filteredApplications.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 space-y-6">
          {/* FILTER: Search + Status (multi) + Filters (Submitted, Financing, Offer expiring) + Clear + count. */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full">
            <div className="relative flex-1 w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Application ID, customer, or invoice number"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-11 rounded-xl border-input focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Status: multi-select, first. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Status
                    {statusFilters.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none bg-primary text-primary-foreground"
                      >
                        {statusFilters.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="pl-8 relative cursor-pointer"
                    onClick={() => {
                      setStatusFilters([]);
                      setPage(1);
                    }}
                  >
                    {statusFilters.length === 0 && (
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-foreground" />
                      </span>
                    )}
                    All Statuses
                  </DropdownMenuItem>
                  {FILTER_STATUSES.map((key) => (
                    <DropdownMenuItem
                      key={`status-${key}`}
                      className="pl-8 relative cursor-pointer"
                      onClick={() => {
                        setStatusFilters((prev) =>
                          prev.includes(key)
                            ? prev.filter((s) => s !== key)
                            : [...prev, key]
                        );
                        setPage(1);
                      }}
                    >
                      {statusFilters.includes(key) && (
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-foreground" />
                        </span>
                      )}
                      {STATUS[key]?.label ?? key}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filters: Submitted, Financing, Offer expiring. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <FunnelIcon className="h-4 w-4" />
                    Filters
                    {(submittedFilter !== "all" || financingFilter !== "all" || offerExpiryFilter !== "all") && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none bg-primary text-primary-foreground"
                      >
                        {[
                          submittedFilter !== "all",
                          financingFilter !== "all",
                          offerExpiryFilter !== "all",
                        ].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-0">
                  <div className="p-1">
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
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <DropdownMenuLabel>Submitted in</DropdownMenuLabel>
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
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <DropdownMenuLabel>Offer expiring</DropdownMenuLabel>
                    {[
                      { value: "all", label: "All" },
                      { value: "3d", label: "3 days" },
                      { value: "7d", label: "7 days" },
                      { value: "14d", label: "14 days" },
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
                    setStatusFilters([]);
                    setFinancingFilter("all");
                    setSubmittedFilter("all");
                    setOfferExpiryFilter("all");
                    setPage(1);
                  }}
                  className="gap-2 h-11 rounded-xl hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <XMarkIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}

              <Badge
                variant="secondary"
                className="h-11 px-4 rounded-xl text-sm font-medium bg-muted text-muted-foreground border-none whitespace-nowrap"
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
                    onViewSignedContractOffer={handleViewSignedContractOffer}
                    onViewSignedInvoiceOffer={handleViewSignedInvoiceOffer}
                    onReviewContractOffer={openReviewContractOffer}
                    onReviewInvoiceOffer={openReviewInvoiceOffer}
                    onCancelApplication={handleWithdrawApplicationClick}
                    onDeleteDraft={handleDeleteDraftClick}
                    onWithdrawInvoice={handleWithdrawInvoiceClick}
                    isCancelApplicationPending={cancelApplication.isPending}
                    isWithdrawInvoicePending={withdrawInvoice.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 md:py-16 text-center text-[17px] leading-7 text-muted-foreground">
                {totalCount === 0
                  ? "No applications yet."
                  : "No applications match your filters."}
              </div>
            )}

            {filteredApplications.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-[15px] text-muted-foreground">
                    <span>Rows per page:</span>
                    <Select
                      value={String(perPage)}
                      onValueChange={(v) => {
                        setPerPage(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-11 w-20 rounded-xl border-input focus:ring-2 focus:ring-primary">
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
                  <span className="text-[15px] text-muted-foreground">
                    Showing {startIndex}-{endIndex} of {filteredApplications.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                  <span className="text-[15px] font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page === totalPages}
                    className="h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
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

      <ConfirmDialog
        open={withdrawApplicationDialogOpen}
        onOpenChange={(open) => {
          setWithdrawApplicationDialogOpen(open);
          if (!open) {
            setWithdrawApplicationId(null);
            withdrawDialogScheduledRef.current = false;
          }
        }}
        title="Withdraw application?"
        description="Are you sure you want to withdraw this application? This action cannot be undone."
        confirmText="Withdraw"
        variant="destructive"
        onConfirm={handleWithdrawApplicationConfirm}
        isLoading={cancelApplication.isPending}
      />

      <ConfirmDialog
        open={withdrawInvoiceDialogOpen}
        onOpenChange={(open) => {
          setWithdrawInvoiceDialogOpen(open);
          if (!open) {
            setWithdrawInvoicePayload(null);
            withdrawInvoiceDialogScheduledRef.current = false;
          }
        }}
        title="Withdraw invoice?"
        description="Are you sure you want to withdraw this invoice? This action cannot be undone."
        confirmText="Withdraw"
        variant="destructive"
        onConfirm={handleWithdrawInvoiceConfirm}
        isLoading={withdrawInvoice.isPending}
      />

      {reviewModalOpen && selectedApplicationId && (
        <ReviewOfferModal
          type={offerType}
          applicationId={selectedApplicationId}
          contractId={offerType === "contract" ? selectedContractId ?? undefined : undefined}
          invoice={offerType === "invoice" ? selectedInvoice ?? undefined : undefined}
          onClose={() => setReviewModalOpen(false)}
        />
      )}

      <Dialog open={signingReturnDialogOpen} onOpenChange={setSigningReturnDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Offer approved</DialogTitle>
            <DialogDescription className="text-[17px] leading-7 text-muted-foreground">
              Thank you for completing signing. Your offer will show as approved once processing finishes. You can
              download the signed offer letter from this page when it becomes available.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <Button type="button" className="rounded-xl" onClick={() => setSigningReturnDialogOpen(false)}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
