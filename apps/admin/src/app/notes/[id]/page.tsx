"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowPathIcon, BanknotesIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
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
import { NoteStatusBadge, Skeleton, StatusBadge, getNoteDerivedStatusToken } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { isNoteSettlementPosted, type NoteDetail } from "@cashsouk/types";
import { useNoteDetail } from "@/notes/hooks/use-note-detail";
import {
  useCloseNoteFunding,
  useFailNoteFunding,
  usePauseNoteListing,
  usePublishNote,
  useResumeNoteListing,
  useUpdateNoteFeatured,
  useUnpublishNote,
} from "@/notes/hooks/use-notes";
import { LedgerPanel } from "@/notes/components/ledger-panel";
import { NoteCampaignActions } from "@/notes/components/note-campaign-actions";
import { NoteLifecycleCard } from "@/notes/components/note-lifecycle-card";
import {
  NoteProspectusStatusCard,
} from "@/notes/components/note-prospectus-status-card";
import { NoteInvestorsPanel } from "@/notes/components/note-investors-panel";
import { useOpenAdminProspectusPdf } from "@/notes/hooks/use-prospectus-review";
import { getNoteCommercialTermRows } from "@/notes/utils/note-commercial-terms";
import { NoteTimelinePanel } from "@/notes/components/note-timeline-panel";
import { SettlementPanel } from "@/notes/components/settlement-panel";
import { SourceApplicationPanel } from "@/notes/components/source-application-panel";
import { IssuerPayoutCard } from "@/notes/components/issuer-payout-card";
import { NoteWorkflowTabHeader } from "@/notes/components/note-workflow-tab-header";
import {
  AdminDetailTabPanel,
  AdminDetailTabs,
  AdminEntityHeader,
  AdminEntitySummaryCard,
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
  NOTE_REFERENCE_TAB_TOKEN,
  noteDetailTabStatusToken,
  noteLatePaymentTabStatusToken,
  resolveNoteCampaignTabStatus,
  resolveNoteDetailNextAction,
  resolveNoteDisbursementTabStatus,
  resolveNoteServicingTabStatus,
  type NoteDetailTabId,
} from "@/notes/utils/note-detail-next-action";
import { type NoteLifecycleAction } from "@/notes/utils/note-lifecycle-actions";
import { resolveNoteSourceLinkage } from "@/notes/utils/note-source-linkage";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
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

function getNotePaymentDueSummary(note: NoteDetail) {
  const paymentDueDate = getNotePaymentDueDate(note);
  const settled = isNoteSettlementPosted(note);
  const defaulted = note.status === "DEFAULTED" || note.servicingStatus === "DEFAULTED";
  const highlight =
    !settled &&
    (note.status === "ACTIVE" ||
      note.status === "ARREARS" ||
      note.status === "DEFAULTED" ||
      note.servicingStatus === "LATE" ||
      note.servicingStatus === "ARREARS");

  return {
    label: "Payment due",
    value: paymentDueDate ? format(new Date(paymentDueDate), "dd MMM yyyy") : "Not set",
    hint: settled
      ? "Settled"
      : defaulted
        ? "Defaulted"
        : (formatPaymentDueHint(paymentDueDate) ?? undefined),
    accentClassName: maturityCountdownClass(calendarDaysUntilMaturity(paymentDueDate), {
      highlight,
      variant: "date" as const,
      settled,
    }),
  };
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-72 max-w-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
            </div>
          </div>
          <Skeleton className="mt-6 h-28 w-full rounded-xl" />
        </div>
        <div className="border-t bg-muted/40 px-6 py-4 md:px-8">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
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
  pauseListing: {
    title: "Pause campaign?",
    description:
      "This temporarily hides the listing from the investor marketplace. Existing commitments stay in place and funds are not returned. You can resume funding later, or fail funding if you need to refund investors.",
    confirmLabel: "Pause campaign",
    successLabel: "Campaign paused",
  },
  resumeListing: {
    title: "Resume campaign?",
    description:
      "This republishes the listing on the investor marketplace. Funding remains open and existing commitments are unchanged.",
    confirmLabel: "Resume campaign",
    successLabel: "Campaign resumed",
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
      "This marks the funding attempt as unsuccessful. Each committed investment is released and that investor's committed amount is credited back to their wallet. The note cannot be reopened.",
    confirmLabel: "Fail Funding",
    successLabel: "Funding failed — committed amounts returned to investor wallets",
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
  const pauseListing = usePauseNoteListing();
  const resumeListing = useResumeNoteListing();
  const closeFunding = useCloseNoteFunding();
  const failFunding = useFailNoteFunding();
  const updateNoteFeatured = useUpdateNoteFeatured();
  const openProspectusPdf = useOpenAdminProspectusPdf();
  const [pendingAction, setPendingAction] = React.useState<NoteLifecycleAction | null>(null);
  const [featuredEnabled, setFeaturedEnabled] = React.useState(false);

  const lifecyclePending = React.useMemo(
    () => ({
      publish: publishNote.isPending,
      unpublish: unpublishNote.isPending,
      pauseListing: pauseListing.isPending,
      resumeListing: resumeListing.isPending,
      closeFunding: closeFunding.isPending,
      failFunding: failFunding.isPending,
    }),
    [
      publishNote.isPending,
      unpublishNote.isPending,
      pauseListing.isPending,
      resumeListing.isPending,
      closeFunding.isPending,
      failFunding.isPending,
    ]
  );

  const disbursementWithdrawal = React.useMemo(
    () => (note ? findNoteDisbursementWithdrawal(note) : null),
    [note]
  );
  const nextAction = React.useMemo(
    () => (note ? resolveNoteDetailNextAction(note) : null),
    [note]
  );
  const { activeTab, setActiveTab } = useAdminDetailTabState<NoteDetailTabId>({
    isValidTab: isNoteDetailTabId,
    computedTab: nextAction?.tabId ?? null,
  });

  const tabs = React.useMemo<AdminDetailTab<NoteDetailTabId>[]>(() => {
    if (!note) return [];
    const campaignToken = noteDetailTabStatusToken(resolveNoteCampaignTabStatus(note));
    const disbursementToken = noteDetailTabStatusToken(resolveNoteDisbursementTabStatus(note));
    const servicingToken = noteDetailTabStatusToken(resolveNoteServicingTabStatus(note));
    const latePaymentPhase = resolveLatePaymentTimeline(note).phase;
    const latePaymentToken = noteLatePaymentTabStatusToken(latePaymentPhase);

    return [
      {
        id: "campaign",
        label: "Campaign",
        statusToken: campaignToken,
        statusLabel: adminTabStatusLabel(campaignToken),
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
        id: "ledger",
        label: "Ledger",
        statusToken: NOTE_REFERENCE_TAB_TOKEN,
      },
      {
        id: "activity",
        label: "Activity",
        statusToken: NOTE_REFERENCE_TAB_TOKEN,
      },
    ];
  }, [note]);

  const runConfirmedAction = async () => {
    if (!note || !pendingAction) return;
    const copy = noteActionCopy[pendingAction];
    const actions: Record<NoteLifecycleAction, () => Promise<unknown>> = {
      publish: () => publishNote.mutateAsync(note.id),
      unpublish: () => unpublishNote.mutateAsync(note.id),
      pauseListing: () => pauseListing.mutateAsync(note.id),
      resumeListing: () => resumeListing.mutateAsync(note.id),
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
    pauseListing.isPending ||
    resumeListing.isPending ||
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
  const resolvedTab: NoteDetailTabId = activeTab ?? nextAction?.tabId ?? "campaign";
  const headerMetrics = React.useMemo(() => {
    if (!note) return [];
    const servicingMetrics = isNoteActiveLoan(note)
      ? [
          {
            label: "Settlement amount",
            value: formatCurrency(note.settlementAmount),
          },
        ]
      : [];
    return [...servicingMetrics, ...getNoteCommercialTermRows(note)];
  }, [note]);

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
                  variant="hero"
                  tone={getNoteDerivedStatusToken(note)}
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
                  summaryCards={[
                    <AdminEntitySummaryCard key="payment-due" {...getNotePaymentDueSummary(note)} />,
                    <AdminEntitySummaryCard
                      key="investors"
                      label="Investors"
                      value={
                        <button
                          type="button"
                          className="appearance-none bg-transparent p-0 text-inherit underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={() => setActiveTab("campaign")}
                          aria-label={`Open Campaign tab, ${note.investments.length} investor${note.investments.length === 1 ? "" : "s"}`}
                        >
                          {note.investments.length}
                        </button>
                      }
                    />,
                  ]}
                  visualization={
                    <AdminMetricProgress
                      variant="hero"
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
                      <AdminDetailTabPanel value="campaign" preserveMount>
                        <div className="space-y-6">
                          <NoteProspectusStatusCard
                            note={note}
                            onOpenWorkspace={() => router.push(`/notes/${note.id}/prospectus`)}
                            onViewProspectus={() => {
                              void openProspectusPdf.mutateAsync(note.id).catch((err) => {
                                toast.error(
                                  err instanceof Error ? err.message : "Prospectus PDF is not available"
                                );
                              });
                            }}
                            viewPending={openProspectusPdf.isPending}
                          />
                          <NoteCampaignActions
                            note={note}
                            pending={lifecyclePending}
                            onRequestAction={(action) => setPendingAction(action)}
                            canManage={canManage}
                            featuredEnabled={featuredEnabled}
                            featuredPending={updateNoteFeatured.isPending}
                            onToggleFeatured={(nextValue) => void handleToggleFeatured(nextValue)}
                          />
                          <NoteInvestorsPanel note={note} />
                        </div>
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
                                  Close funding on the Campaign tab to create the issuer
                                  disbursement workflow.
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

                      <AdminDetailTabPanel value="ledger" preserveMount>
                        <LedgerPanel note={note} />
                      </AdminDetailTabPanel>

                      <AdminDetailTabPanel value="activity" preserveMount>
                        <NoteTimelinePanel note={note} />
                      </AdminDetailTabPanel>
                    </AdminDetailTabs>
                  }
                >
                  <NoteLifecycleCard note={note} />
                  <SourceApplicationPanel note={note} />
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
