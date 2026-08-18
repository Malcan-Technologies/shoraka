"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowPathIcon, BanknotesIcon, DocumentTextIcon, MapIcon } from "@heroicons/react/24/outline";
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
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { NoteStatusBadge, Skeleton, StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { isNoteSettlementPosted } from "@cashsouk/types";
import { useNoteDetail } from "@/notes/hooks/use-note-detail";
import {
  useCloseNoteFunding,
  useFailNoteFunding,
  usePublishNote,
  useUpdateNoteFeatured,
  useUnpublishNote,
} from "@/notes/hooks/use-notes";
import { LedgerPanel } from "@/notes/components/ledger-panel";
import { NoteLifecycleCard } from "@/notes/components/note-lifecycle-card";
import {
  NoteProspectusStatusCard,
} from "@/notes/components/note-prospectus-status-card";
import { NoteInvestorsPanel } from "@/notes/components/note-investors-panel";
import { getNoteCommercialTermRows } from "@/notes/utils/note-commercial-terms";
import { NoteTimelinePanel } from "@/notes/components/note-timeline-panel";
import { ContextualAuditHistoryPanel } from "@/components/audit/contextual-audit-history-panel";
import { noteAuditToDetail } from "@/components/audit/contextual-audit-mappers";
import { useNoteAuditHistory } from "@/hooks/use-note-audit-history";
import { SettlementPanel } from "@/notes/components/settlement-panel";
import { SourceApplicationPanel } from "@/notes/components/source-application-panel";
import { IssuerPayoutCard } from "@/notes/components/issuer-payout-card";
import { NoteWorkflowTabHeader } from "@/notes/components/note-workflow-tab-header";
import {
  AdminCollapsibleCard,
  AdminDetailTabPanel,
  AdminDetailTabs,
  AdminEntityHeader,
  AdminMetricProgress,
  AdminNextActionBanner,
  AdminRelatedRecordsRail,
  useAdminDetailTabState,
  type AdminDetailTab,
} from "@/components/admin-detail";
import {
  LATE_PAYMENT_WORKFLOW_BADGE,
  getNotePaymentDueDate,
  resolveLatePaymentTimeline,
} from "@/notes/utils/late-payment-workflow";
import {
  findNoteDisbursementWithdrawal,
  isNoteDetailTabId,
  noteDetailTabStatusToken,
  noteLatePaymentTabStatusToken,
  resolveNoteActivityTabToken,
  resolveNoteDetailNextAction,
  resolveNoteDisbursementTabStatus,
  resolveNoteInvestorsTabToken,
  resolveNoteLedgerTabToken,
  resolveNoteOverviewTabStatus,
  resolveNoteServicingTabStatus,
  type NoteDetailTabId,
} from "@/notes/utils/note-detail-next-action";
import {
  getNoteLifecycleCardTone,
  type NoteLifecycleAction,
} from "@/notes/utils/note-lifecycle-actions";
import { resolveNoteSourceLinkage } from "@/notes/utils/note-source-linkage";
import { isNoteLifecycleVisuallyComplete } from "@/notes/utils/settlement-trustee-workflow";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { adminTabStatusLabel } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import {
  getNoteFundingAccentClass,
  getNoteFundingIndicatorClass,
  getNoteFundingProgressClass,
  isNoteActiveLoan,
} from "@/notes/utils/funding-progress";
import {
  calendarDaysUntilMaturity,
  formatPaymentDueHint,
  maturityCountdownClass,
} from "@/notes/utils/maturity-countdown";

function NoteAuditHistoryCard({ noteId }: { noteId: string }) {
  const [page, setPage] = React.useState(1);
  const pageSize = 15;
  const { data, isLoading, error } = useNoteAuditHistory(noteId, page, pageSize);
  return (
    <ContextualAuditHistoryPanel
      rows={(data?.logs ?? []).map(noteAuditToDetail)}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      emptyMessage="No audit records found"
      page={page}
      pageSize={pageSize}
      totalCount={data?.pagination.totalCount}
      onPageChange={setPage}
    />
  );
}

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
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

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
  const { can } = usePermissions();
  const canManage = can("notes.manage");
  const canDisbursement = can("notes.disbursement.manage");
  const params = useParams();
  const router = useRouter();
  const noteId = typeof params.id === "string" ? params.id : "";
  const { data: note, isLoading, error } = useNoteDetail(noteId);

  const publishNote = usePublishNote();
  const unpublishNote = useUnpublishNote();
  const closeFunding = useCloseNoteFunding();
  const failFunding = useFailNoteFunding();
  const updateNoteFeatured = useUpdateNoteFeatured();
  const [pendingAction, setPendingAction] = React.useState<NoteLifecycleAction | null>(null);
  const [featuredEnabled, setFeaturedEnabled] = React.useState(false);

  const lifecyclePending = React.useMemo(
    () => ({
      publish: publishNote.isPending,
      unpublish: unpublishNote.isPending,
      closeFunding: closeFunding.isPending,
      failFunding: failFunding.isPending,
    }),
    [publishNote.isPending, unpublishNote.isPending, closeFunding.isPending, failFunding.isPending]
  );

  const disbursementWithdrawal = React.useMemo(
    () => (note ? findNoteDisbursementWithdrawal(note) : null),
    [note]
  );
  const nextAction = React.useMemo(
    () => (note ? resolveNoteDetailNextAction(note) : null),
    [note]
  );
  const lifecycleCardTone = note ? getNoteLifecycleCardTone(note) : null;
  const { activeTab, setActiveTab } = useAdminDetailTabState<NoteDetailTabId>({
    isValidTab: isNoteDetailTabId,
    computedTab: nextAction?.tabId ?? null,
  });

  const tabs = React.useMemo<AdminDetailTab<NoteDetailTabId>[]>(() => {
    if (!note) return [];
    const overviewToken = noteDetailTabStatusToken(resolveNoteOverviewTabStatus(note));
    const disbursementToken = noteDetailTabStatusToken(resolveNoteDisbursementTabStatus(note));
    const servicingToken = noteDetailTabStatusToken(resolveNoteServicingTabStatus(note));
    const latePaymentPhase = resolveLatePaymentTimeline(note).phase;
    const latePaymentToken = noteLatePaymentTabStatusToken(latePaymentPhase);
    const investorsToken = resolveNoteInvestorsTabToken(note);
    const ledgerToken = resolveNoteLedgerTabToken(note);
    const activityToken = resolveNoteActivityTabToken(note);

    return [
      {
        id: "overview",
        label: "Overview",
        statusToken: overviewToken,
        statusLabel: adminTabStatusLabel(overviewToken),
      },
      {
        id: "disbursement",
        label: "Disbursement",
        statusToken: disbursementToken,
        statusLabel: adminTabStatusLabel(disbursementToken),
      },
      {
        id: "servicing",
        label: "Servicing",
        statusToken: servicingToken,
        statusLabel: adminTabStatusLabel(servicingToken),
      },
      {
        id: "late-payment",
        label: "Late Payment",
        statusToken: latePaymentToken,
        statusLabel: LATE_PAYMENT_WORKFLOW_BADGE[latePaymentPhase].label,
      },
      {
        id: "investors",
        label: "Investors",
        statusToken: investorsToken,
        statusLabel: adminTabStatusLabel(investorsToken),
      },
      {
        id: "ledger",
        label: "Ledger",
        statusToken: ledgerToken,
        statusLabel: adminTabStatusLabel(ledgerToken),
      },
      {
        id: "activity",
        label: "Activity",
        statusToken: activityToken,
        statusLabel: adminTabStatusLabel(activityToken),
      },
    ];
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

  const linkage = note ? resolveNoteSourceLinkage(note) : null;
  const resolvedTab: NoteDetailTabId = activeTab ?? nextAction?.tabId ?? "overview";
  const headerMetrics = React.useMemo(() => {
    if (!note) return [];
    const paymentDueDate = getNotePaymentDueDate(note);
    const paymentDueDays = calendarDaysUntilMaturity(paymentDueDate);
    const settled = isNoteSettlementPosted(note);
    const defaulted = note.status === "DEFAULTED" || note.servicingStatus === "DEFAULTED";
    const highlightPaymentDue =
      !settled &&
      (note.status === "ACTIVE" ||
        note.status === "ARREARS" ||
        note.status === "DEFAULTED" ||
        note.servicingStatus === "LATE" ||
        note.servicingStatus === "ARREARS");
    const servicingMetrics = isNoteActiveLoan(note)
      ? [
          {
            label: "Settlement amount",
            value: formatCurrency(note.settlementAmount),
          },
          {
            label: "Payment due",
            value: paymentDueDate ? format(new Date(paymentDueDate), "dd MMM yyyy") : "Not set",
            hint: settled
              ? "Settled"
              : defaulted
                ? "Defaulted"
                : (formatPaymentDueHint(paymentDueDate) ?? undefined),
            accentClassName: maturityCountdownClass(paymentDueDays, {
              highlight: highlightPaymentDue,
              variant: "date",
              settled,
            }),
          },
        ]
      : [];
    return [
      ...servicingMetrics,
      {
        label: "Investors",
        value: (
          <button
            type="button"
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setActiveTab("investors")}
            aria-label={`Open Investors tab, ${note.investments.length} investor${note.investments.length === 1 ? "" : "s"}`}
          >
            {note.investments.length}
          </button>
        ),
      },
      ...getNoteCommercialTermRows(note),
    ];
  }, [note, setActiveTab]);

  return (
    <RequirePermission permission="notes.view">
      <>
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
            {isLoading ? <PageSkeleton /> : null}

            {error ? (
              <div className="py-8 text-center text-destructive">
                Error loading note: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : null}

            {note && nextAction && linkage ? (
              <div className="space-y-6">
                <AdminEntityHeader
                  backHref="/notes"
                  backLabel="Notes"
                  eyebrow="Note detail"
                  title={note.title}
                  subtitle={`${note.noteReference} · ${note.issuerName ?? "Unknown issuer"}`}
                  icon={DocumentTextIcon}
                  chips={
                    <>
                      <NoteStatusBadge note={note} marker="dot" />
                      {linkage.contractHref ? (
                        <Link
                          href={linkage.contractHref}
                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <StatusBadge
                            label={linkage.typeLabel}
                            status="neutral"
                            showDot={false}
                            className="hover:underline"
                          />
                        </Link>
                      ) : (
                        <StatusBadge
                          label={linkage.typeLabel}
                          status="neutral"
                          showDot={false}
                        />
                      )}
                    </>
                  }
                  metrics={headerMetrics}
                  visualization={
                    <AdminMetricProgress
                      percent={note.fundingPercent}
                      leftLabel="Funded"
                      leftValue={formatCurrency(note.fundedAmount)}
                      leftHint={`of ${formatCurrency(note.targetAmount)} target`}
                      rightLabel="Progress"
                      rightValue={`${note.fundingPercent.toFixed(1)}%`}
                      barClassName={getNoteFundingProgressClass(note)}
                      indicatorClassName={getNoteFundingIndicatorClass(note)}
                      accentClassName={getNoteFundingAccentClass(note)}
                    />
                  }
                  actions={
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex items-center gap-2 rounded-full border px-3 py-1.5",
                              !canManage && "cursor-not-allowed opacity-60"
                            )}
                          >
                            <span className="text-meta font-medium text-muted-foreground">
                              Featured
                            </span>
                            <Switch
                              id="note-featured-toggle"
                              checked={featuredEnabled}
                              onCheckedChange={(checked) =>
                                void handleToggleFeatured(Boolean(checked))
                              }
                              disabled={updateNoteFeatured.isPending || !canManage}
                            />
                          </div>
                        </TooltipTrigger>
                        {!canManage ? (
                          <TooltipContent side="bottom" className="max-w-xs">
                            You do not have permission to perform this action.
                          </TooltipContent>
                        ) : null}
                      </Tooltip>
                    </TooltipProvider>
                  }
                />

                {nextAction.tone === "action" ? (
                  <AdminNextActionBanner
                    title={nextAction.title}
                    description={nextAction.description}
                    ctaLabel={nextAction.ctaLabel}
                    href={nextAction.href}
                    onClick={
                      nextAction.href ? undefined : () => setActiveTab(nextAction.tabId)
                    }
                  />
                ) : null}

                <AdminRelatedRecordsRail
                  main={
                    <AdminDetailTabs
                      tabs={tabs}
                      value={resolvedTab}
                      onValueChange={setActiveTab}
                    >
                      <AdminDetailTabPanel value="overview" preserveMount>
                        {/* The stage map is the orientation view, so it stays open until the note is finished. */}
                        <AdminCollapsibleCard
                          title="Lifecycle"
                          description="Publication, funding, disbursement, and settlement stages."
                          icon={MapIcon}
                          needsAction={lifecycleCardTone === "action"}
                          waiting={lifecycleCardTone === "waiting"}
                          defaultOpen={!isNoteLifecycleVisuallyComplete(note)}
                        >
                          <NoteLifecycleCard
                            note={note}
                            pending={lifecyclePending}
                            onRequestAction={(action) => setPendingAction(action)}
                            canManage={canManage}
                            unframed
                          />
                        </AdminCollapsibleCard>
                      </AdminDetailTabPanel>

                      <AdminDetailTabPanel value="disbursement" preserveMount>
                        <Card className="rounded-2xl">
                          <NoteWorkflowTabHeader
                            icon={BanknotesIcon}
                            title="Disbursement"
                            description="Manage Tawarruq execution, trustee submission, and issuer payout before servicing begins."
                          />
                          <CardContent className="space-y-6 pt-0">
                            {disbursementWithdrawal &&
                            disbursementWithdrawal.status !== "CANCELLED" ? (
                              <IssuerPayoutCard
                                note={note}
                                withdrawal={disbursementWithdrawal}
                                kind="DISBURSEMENT"
                                servicingBlockedReason={null}
                                canManage={canDisbursement}
                              />
                            ) : (
                              <div className="rounded-xl border border-dashed bg-muted/20 p-4">
                                <p className="text-ui font-medium">Disbursement not started</p>
                                <p className="mt-1 text-meta text-muted-foreground">
                                  Close funding on this note to create the issuer disbursement
                                  workflow. The Overview tab shows the next funding action.
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </AdminDetailTabPanel>

                      <div
                        className={
                          resolvedTab === "servicing" || resolvedTab === "late-payment"
                            ? "mt-4 space-y-6"
                            : "hidden"
                        }
                      >
                        <SettlementPanel
                          note={note}
                          section={resolvedTab === "late-payment" ? "late-payment" : "settlement"}
                        />
                      </div>

                      <AdminDetailTabPanel value="investors" preserveMount>
                        <NoteInvestorsPanel note={note} />
                      </AdminDetailTabPanel>

                      <AdminDetailTabPanel value="ledger" preserveMount>
                        <LedgerPanel note={note} />
                      </AdminDetailTabPanel>

                      <AdminDetailTabPanel value="activity" preserveMount>
                        <div className="space-y-6">
                          <NoteTimelinePanel note={note} />
                          <NoteAuditHistoryCard noteId={note.id} />
                        </div>
                      </AdminDetailTabPanel>
                    </AdminDetailTabs>
                  }
                >
                  <SourceApplicationPanel note={note} />
                  <NoteProspectusStatusCard
                    layout="rail"
                    note={note}
                    onReviewProspectus={() => router.push(`/notes/${note.id}/prospectus`)}
                  />
                </AdminRelatedRecordsRail>
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
                className={cn(
                  "gap-2",
                  confirmCopy?.destructive &&
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
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
