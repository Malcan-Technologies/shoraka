"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { Skeleton } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { useNoteDetail } from "@/notes/hooks/use-note-detail";
import {
  useCloseNoteFunding,
  useFailNoteFunding,
  usePublishNote,
  useUpdateNoteFeatured,
  useUnpublishNote,
} from "@/notes/hooks/use-notes";
import { LedgerPanel } from "@/notes/components/ledger-panel";
import {
  NoteLifecycleCard,
  type NoteLifecycleAction,
} from "@/notes/components/note-lifecycle-card";
import { NoteInvestorsPanel } from "@/notes/components/note-investors-panel";
import { NoteStatusBadge } from "@cashsouk/ui";
import { NoteTermsPanel } from "@/notes/components/note-terms-panel";
import { NoteTimelinePanel } from "@/notes/components/note-timeline-panel";
import { SettlementPanel } from "@/notes/components/settlement-panel";
import { SourceApplicationPanel } from "@/notes/components/source-application-panel";
import { IssuerPayoutCard } from "@/notes/components/issuer-payout-card";
import { OfferSigningPanel } from "@/components/offer-signing-panel";
import { useResignNoteInvoiceOffer } from "@/notes/hooks/use-resign-invoice-offer";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  isSoukscoreRiskRating,
  mapNoteSettlementToPoolSummary,
  type NoteDetail,
  type NoteSettlementPoolSummary,
} from "@cashsouk/types";

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

function getInvoiceAmount(note: NonNullable<ReturnType<typeof useNoteDetail>["data"]>) {
  const extended = note as typeof note & { invoiceAmount?: number; settlementAmount?: number };
  return extended.invoiceAmount ?? extended.settlementAmount ?? note.requestedAmount;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getRiskRating(note: NoteDetail) {
  const offerDetails = asRecord(note.invoiceSnapshot?.offer_details);
  const riskRating = offerDetails?.risk_rating;
  return isSoukscoreRiskRating(riskRating) ? riskRating : "—";
}

function getPostedSettlementSummary(note: NoteDetail): NoteSettlementPoolSummary | null {
  if (note.settlementSummary?.status === "POSTED") return note.settlementSummary;
  const settlement = note.settlements.find((item) => item.status === "POSTED") ?? null;
  return settlement ? mapNoteSettlementToPoolSummary(settlement) : null;
}

function getApprovedSettlementSummary(note: NoteDetail): NoteSettlementPoolSummary | null {
  const settlement = note.settlements.find((item) => item.status === "APPROVED") ?? null;
  return settlement ? mapNoteSettlementToPoolSummary(settlement) : null;
}

function BucketPayoutCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{formatCurrency(value)}</div>
    </div>
  );
}

type SimpleTabStatus = "done" | "needs-action" | "not-started" | "view-only";

const TAB_STATUS_BADGE_COPY: Record<
  SimpleTabStatus,
  { label: string; className: string; dotClass: string }
> = {
  done: {
    label: "Done",
    className:
      "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
    dotClass: "bg-status-success-text dark:bg-emerald-300",
  },
  "needs-action": {
    label: "In progress",
    className: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    dotClass: "bg-amber-500 dark:bg-amber-300",
  },
  "not-started": {
    label: "Not started",
    className:
      "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    dotClass: "bg-status-neutral-text dark:bg-slate-300",
  },
  "view-only": {
    label: "View only",
    className:
      "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    dotClass: "bg-status-neutral-text dark:bg-slate-300",
  },
};

const noteActionCopy: Record<
  NoteLifecycleAction,
  {
    title: string;
    description: string;
    confirmLabel: string;
    successLabel: string;
    destructive?: boolean;
  }
> = {
  publish: {
    title: "Publish note to marketplace?",
    description:
      "This will make the note visible and investable in the investor marketplace. Confirm that the source invoice, terms, risk disclosure, and listing details have been reviewed.",
    confirmLabel: "Publish",
    successLabel: "Note published to marketplace",
  },
  unpublish: {
    title: "Unpublish note?",
    description:
      "This will remove the note from the investor marketplace. Use this only before investor commitments exist or when the listing must be withdrawn.",
    confirmLabel: "Unpublish",
    successLabel: "Note unpublished",
  },
  closeFunding: {
    title: "Close funding?",
    description:
      "Confirm that the minimum funding threshold has been reached. Closing locks investor commitments, confirms investments, posts the disbursement ledger entries, and creates a draft Issuer Disbursement withdrawal. The note moves to FUNDING until the trustee pays out the net amount to the issuer, then transitions to ACTIVE.",
    confirmLabel: "Close Funding",
    successLabel: "Funding closed — awaiting issuer disbursement",
  },
  failFunding: {
    title: "Fail funding?",
    description:
      "This will mark the marketplace funding attempt as unsuccessful. Investor commitments should be released or refunded according to the payment rail model.",
    confirmLabel: "Fail Funding",
    successLabel: "Funding failed",
    destructive: true,
  },
};

export default function NoteDetailPage() {
  type NoteDetailTabId = "disbursement" | "servicing-settlement" | "ledger" | "investors";
  const { can } = usePermissions();
  const canManage = can("notes.manage");
  const canDisbursement = can("notes.disbursement.manage");
  const params = useParams();
  const router = useRouter();
  const noteId = typeof params.id === "string" ? params.id : "";
  const { data: note, isLoading, error } = useNoteDetail(noteId);
  const resignInvoiceOffer = useResignNoteInvoiceOffer(noteId);
  const publishNote = usePublishNote();
  const unpublishNote = useUnpublishNote();
  const closeFunding = useCloseNoteFunding();
  const failFunding = useFailNoteFunding();
  const updateNoteFeatured = useUpdateNoteFeatured();
  const [pendingAction, setPendingAction] = React.useState<NoteLifecycleAction | null>(null);
  const [featuredEnabled, setFeaturedEnabled] = React.useState(false);
  const [activeNoteTab, setActiveNoteTab] = React.useState<NoteDetailTabId>("disbursement");

  const lifecyclePending = React.useMemo(
    () => ({
      publish: publishNote.isPending,
      unpublish: unpublishNote.isPending,
      closeFunding: closeFunding.isPending,
      failFunding: failFunding.isPending,
    }),
    [publishNote.isPending, unpublishNote.isPending, closeFunding.isPending, failFunding.isPending]
  );

  const disbursementWithdrawal = React.useMemo(() => {
    const withdrawals = note?.withdrawals ?? [];
    return withdrawals.find((w) => w.withdrawalType === "ISSUER_DISBURSEMENT") ?? null;
  }, [note]);
  const disbursementTabStatus = React.useMemo<SimpleTabStatus>(() => {
    if (!disbursementWithdrawal) return "not-started";
    if (disbursementWithdrawal.status === "COMPLETED") return "done";
    return "needs-action";
  }, [disbursementWithdrawal]);
  const servicingSettlementTabStatus = React.useMemo<SimpleTabStatus>(() => {
    if (!note) return "not-started";

    const isDone = note.status === "REPAID" || note.servicingStatus === "SETTLED";
    if (isDone) return "done";

    const hasPendingPayments = note.payments.some((payment) => payment.status === "PENDING");
    const hasUnpostedSettlement = note.settlements.some(
      (settlement) => settlement.status !== "POSTED" && settlement.status !== "VOID"
    );
    const isArrearsOrDefault =
      note.status === "ARREARS" ||
      note.status === "DEFAULTED" ||
      note.servicingStatus === "ARREARS" ||
      note.servicingStatus === "DEFAULTED";
    if (hasPendingPayments || hasUnpostedSettlement || isArrearsOrDefault) {
      return "needs-action";
    }

    const servicingNotStarted =
      note.servicingStatus === "NOT_STARTED" ||
      (note.status !== "ACTIVE" &&
        note.status !== "ARREARS" &&
        note.status !== "DEFAULTED" &&
        note.status !== "REPAID");
    if (servicingNotStarted) return "not-started";

    return "needs-action";
  }, [note]);

  const runConfirmedAction = async () => {
    if (!note || !pendingAction) return;
    const copy = noteActionCopy[pendingAction];
    const actions: Record<NoteLifecycleAction, () => Promise<unknown>> = {
      publish: () => publishNote.mutateAsync(note.id),
      unpublish: () => unpublishNote.mutateAsync(note.id),
      closeFunding: () => closeFunding.mutateAsync(note.id),
      failFunding: () => failFunding.mutateAsync(note.id),
    };

    try {
      await actions[pendingAction]();
      toast.success(copy.successLabel);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
    setPendingAction(null);
  };

  const confirmCopy = pendingAction ? noteActionCopy[pendingAction] : null;
  const confirmPending =
    publishNote.isPending ||
    unpublishNote.isPending ||
    closeFunding.isPending ||
    failFunding.isPending;

  React.useEffect(() => {
    if (!note) return;
    setFeaturedEnabled(note.isFeatured);
  }, [note]);

  const handleToggleFeatured = async (nextValue: boolean) => {
    if (!note) return;
    const previousValue = featuredEnabled;
    setFeaturedEnabled(nextValue);
    try {
      await updateNoteFeatured.mutateAsync({
        id: note.id,
        input: {
          isFeatured: nextValue,
        },
      });
      toast.success(nextValue ? "Note marked as featured" : "Note removed from featured");
    } catch (err) {
      setFeaturedEnabled(previousValue);
      toast.error(err instanceof Error ? err.message : "Failed to update featured status");
    }
  };

  return (
    <RequirePermission permission="notes.view">
      <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/notes")}
          className="-ml-1 gap-1.5"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Notes
        </Button>
        <Separator orientation="vertical" className="mx-2 h-4" />
        <h1 className="truncate text-lg font-semibold">
          {isLoading ? "Loading..." : (note?.noteReference ?? "Note detail")}
        </h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
          {isLoading ? <PageSkeleton /> : null}

          {error ? (
            <div className="py-8 text-center text-destructive">
              Error loading note: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : null}

          {note ? (
            <div className="space-y-6">
              {(() => {
                const postedSummary = getPostedSettlementSummary(note);
                const approvedSummary = postedSummary ? null : getApprovedSettlementSummary(note);
                const settlementSummary = postedSummary ?? approvedSummary;
                if (!settlementSummary) return null;
                const isPosted = settlementSummary.status === "POSTED";
                return (
                  <Card
                    className={
                      isPosted
                        ? "rounded-2xl border-emerald-200 bg-emerald-50/70"
                        : "rounded-2xl border-amber-200 bg-amber-50/70"
                    }
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div
                            className={
                              isPosted
                                ? "text-sm font-medium text-emerald-950"
                                : "text-sm font-medium text-amber-950"
                            }
                          >
                            {isPosted ? "Settlement Posted" : "Settlement Approved"}
                          </div>
                          <p
                            className={
                              isPosted
                                ? "mt-1 text-sm text-emerald-900"
                                : "mt-1 text-sm text-amber-900"
                            }
                          >
                            {isPosted
                              ? "This note has been settled and the posted payout has been allocated across the platform buckets."
                              : "Settlement is approved and awaiting post. Bucket amounts below are not yet final on the ledger."}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            isPosted
                              ? "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                          }
                        >
                          {isPosted ? "Posted" : "Approved"}
                        </Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <BucketPayoutCard
                          label="Repayment Pool"
                          value={settlementSummary.grossReceiptAmount}
                        />
                        <BucketPayoutCard
                          label="Investor Pool"
                          value={settlementSummary.investorPoolAmount}
                        />
                        <BucketPayoutCard
                          label="Operating Account"
                          value={settlementSummary.operatingAccountAmount}
                        />
                        <BucketPayoutCard
                          label="Ta'widh Account"
                          value={settlementSummary.tawidhAccountAmount}
                        />
                        <BucketPayoutCard
                          label="Gharamah Account"
                          value={settlementSummary.gharamahAccountAmount}
                        />
                      </div>
                      <div
                        className={
                          isPosted ? "text-sm text-emerald-950" : "text-sm text-amber-950"
                        }
                      >
                        Issuer residual refund:{" "}
                        {formatCurrency(settlementSummary.issuerResidualAmount)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <DocumentTextIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Note Detail
                    </div>
                    <h2 className="truncate text-2xl font-bold">{note.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {note.noteReference} · {note.issuerName ?? "Unknown issuer"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${!canManage ? "cursor-not-allowed opacity-60" : ""}`}>
                          <span className="text-xs font-medium text-muted-foreground">Featured</span>
                          <Switch
                            id="note-featured-toggle"
                            checked={featuredEnabled}
                            onCheckedChange={(checked) => void handleToggleFeatured(Boolean(checked))}
                            disabled={updateNoteFeatured.isPending || !canManage}
                          />
                        </div>
                      </TooltipTrigger>
                      {!canManage && (
                        <TooltipContent side="bottom" className="max-w-xs">You do not have permission to perform this action.</TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <NoteStatusBadge note={note} showDetail />
                </div>
              </div>

              <Card className="rounded-2xl">
                <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6">
                  <div>
                    <div className="text-xs text-muted-foreground">Invoice Amount</div>
                    <div className="mt-1 text-xl font-semibold">
                      {formatCurrency(getInvoiceAmount(note))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Target Amount</div>
                    <div className="mt-1 text-xl font-semibold">
                      {formatCurrency(note.targetAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Funded Amount</div>
                    <div className="mt-1 text-xl font-semibold">
                      {formatCurrency(note.fundedAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Funding Progress</div>
                    <div className="mt-1 text-xl font-semibold">
                      {note.fundingPercent.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Risk Rating</div>
                    <div className="mt-1 text-xl font-semibold">{getRiskRating(note)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Paymaster</div>
                    <div className="mt-1 text-xl font-semibold">{note.paymasterName ?? "-"}</div>
                  </div>
                </CardContent>
              </Card>

              <NoteLifecycleCard
                note={note}
                pending={lifecyclePending}
                onRequestAction={(action) => setPendingAction(action)}
                canManage={canManage}
              />

              <div className="space-y-6">
                <NoteTermsPanel note={note} />
                {note.sourceInvoiceOfferSigning ? (
                  <OfferSigningPanel
                    title="Signed invoice offer"
                    description="Review the active signed invoice offer letter from the source application. Request re-sign when the wrong person signed."
                    signing={note.sourceInvoiceOfferSigning}
                    onResign={
                      note.sourceInvoiceOfferSigning.canResign
                        ? async () => {
                            await resignInvoiceOffer.mutateAsync();
                          }
                        : undefined
                    }
                    resignPending={resignInvoiceOffer.isPending}
                    canManage={canManage}
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div className="min-w-0 space-y-4">
                  <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-xl bg-muted p-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
                    <div className="flex h-auto min-h-11 w-max min-w-full flex-nowrap items-center justify-center gap-2 text-muted-foreground">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveNoteTab("disbursement")}
                        className={
                          activeNoteTab === "disbursement"
                            ? "h-8 shrink-0 rounded-lg bg-background px-3 text-sm shadow-sm sm:px-4"
                            : "h-8 shrink-0 rounded-lg px-3 text-sm text-muted-foreground hover:bg-background/70 hover:text-foreground sm:px-4"
                        }
                      >
                        <span
                          aria-hidden
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${TAB_STATUS_BADGE_COPY[disbursementTabStatus].dotClass}`}
                        />
                        <span className="truncate">Disbursement</span>
                        <span className="sr-only">
                          Status: {TAB_STATUS_BADGE_COPY[disbursementTabStatus].label}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveNoteTab("servicing-settlement")}
                        className={
                          activeNoteTab === "servicing-settlement"
                            ? "h-8 shrink-0 rounded-lg bg-background px-3 text-sm shadow-sm sm:px-4"
                            : "h-8 shrink-0 rounded-lg px-3 text-sm text-muted-foreground hover:bg-background/70 hover:text-foreground sm:px-4"
                        }
                      >
                        <span
                          aria-hidden
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${TAB_STATUS_BADGE_COPY[servicingSettlementTabStatus].dotClass}`}
                        />
                        <span className="truncate">Servicing &amp; Settlement</span>
                        <span className="sr-only">
                          Status: {TAB_STATUS_BADGE_COPY[servicingSettlementTabStatus].label}
                        </span>
                      </Button>
                      <span
                        className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:inline-block"
                        aria-hidden
                      />
                      <span className="hidden shrink-0 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
                        Reference
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveNoteTab("ledger")}
                        className={
                          activeNoteTab === "ledger"
                            ? "h-8 shrink-0 rounded-lg bg-background px-3 text-sm shadow-sm sm:px-4"
                            : "h-8 shrink-0 rounded-lg px-3 text-sm text-muted-foreground hover:bg-background/70 hover:text-foreground sm:px-4"
                        }
                      >
                        <span className="truncate">Ledger</span>
                        <span className="sr-only">Read-only reference</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveNoteTab("investors")}
                        className={
                          activeNoteTab === "investors"
                            ? "h-8 shrink-0 rounded-lg bg-background px-3 text-sm shadow-sm sm:px-4"
                            : "h-8 shrink-0 rounded-lg px-3 text-sm text-muted-foreground hover:bg-background/70 hover:text-foreground sm:px-4"
                        }
                      >
                        <span className="truncate">Investors</span>
                        <span className="sr-only">Read-only reference</span>
                      </Button>
                    </div>
                  </div>

                  <div className={activeNoteTab === "disbursement" ? "space-y-6" : "hidden space-y-6"}>
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Funding &amp; Issuer Disbursement</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Manage Tawarruq/Shoraka execution, trustee submission, and issuer disbursement in one workflow before servicing begins.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {disbursementWithdrawal && disbursementWithdrawal.status !== "CANCELLED" ? (
                          disbursementWithdrawal.status !== "COMPLETED" ? (
                            <div
                              className={`rounded-xl border border-amber-200 p-4 border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]`}
                            >
                              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-900">
                                Awaiting issuer disbursement
                              </div>
                              <p className="text-xs text-amber-900/80">
                                Funding has closed. The net amount below must be paid out to the issuer via
                                the trustee before servicing begins. Once the disbursement is marked complete, the
                                note will move to ACTIVE and repayment receipts can be recorded.
                              </p>
                              <IssuerPayoutCard
                                note={note}
                                withdrawal={disbursementWithdrawal}
                                kind="DISBURSEMENT"
                                servicingBlockedReason={null}
                                canManage={canDisbursement}
                              />
                            </div>
                          ) : (
                            <IssuerPayoutCard
                              note={note}
                              withdrawal={disbursementWithdrawal}
                              kind="DISBURSEMENT"
                              servicingBlockedReason={null}
                              canManage={canDisbursement}
                            />
                          )
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>

                  <div
                    className={
                      activeNoteTab === "servicing-settlement" ? "space-y-6" : "hidden space-y-6"
                    }
                  >
                    <SettlementPanel note={note} />
                  </div>

                  <div className={activeNoteTab === "ledger" ? "space-y-6" : "hidden space-y-6"}>
                    <p className="text-xs text-muted-foreground">
                      Read-only accounting ledger for this note. Export is available from the panel
                      below.
                    </p>
                    <LedgerPanel note={note} />
                  </div>

                  <div className={activeNoteTab === "investors" ? "space-y-6" : "hidden space-y-6"}>
                    <p className="text-xs text-muted-foreground">
                      Read-only investor allocations and commitment history for this note.
                    </p>
                    <NoteInvestorsPanel note={note} />
                  </div>

                </div>
                <div className="min-w-0 space-y-6">
                  <SourceApplicationPanel note={note} />
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Workflow Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span>Disbursement</span>
                        <Badge
                          variant="outline"
                          className={`inline-flex items-center gap-1 ${TAB_STATUS_BADGE_COPY[disbursementTabStatus].className}`}
                        >
                          <span
                            aria-hidden
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${TAB_STATUS_BADGE_COPY[disbursementTabStatus].dotClass}`}
                          />
                          {TAB_STATUS_BADGE_COPY[disbursementTabStatus].label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Servicing &amp; Settlement</span>
                        <Badge
                          variant="outline"
                          className={`inline-flex items-center gap-1 ${TAB_STATUS_BADGE_COPY[servicingSettlementTabStatus].className}`}
                        >
                          <span
                            aria-hidden
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${TAB_STATUS_BADGE_COPY[servicingSettlementTabStatus].dotClass}`}
                          />
                          {TAB_STATUS_BADGE_COPY[servicingSettlementTabStatus].label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                  <NoteTimelinePanel note={note} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={pendingAction != null}
        onOpenChange={(open) => {
          if (!open && !confirmPending) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void runConfirmedAction();
              }}
              disabled={confirmPending}
              className={`gap-2 ${confirmCopy?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
            >
              {confirmPending ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
              {confirmCopy?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    </RequirePermission>
  );
}
