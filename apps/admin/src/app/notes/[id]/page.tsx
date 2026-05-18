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
import { Card, CardContent } from "@/components/ui/card";
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
import { isSoukscoreRiskRating, type NoteDetail, type NoteSettlementPoolSummary } from "@cashsouk/types";

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

function getSettlementSummary(note: NoteDetail): NoteSettlementPoolSummary | null {
  if (note.settlementSummary) return note.settlementSummary;
  const settlement = note.settlements.find((item) => item.status === "POSTED") ?? null;
  if (!settlement) return null;
  return {
    settlementId: settlement.id,
    status: settlement.status,
    grossReceiptAmount: settlement.grossReceiptAmount,
    investorPoolAmount: settlement.investorPrincipal + settlement.investorProfitNet,
    operatingAccountAmount: settlement.serviceFeeAmount,
    tawidhAccountAmount: settlement.tawidhAmount,
    gharamahAccountAmount: settlement.gharamahAmount,
    issuerResidualAmount: settlement.issuerResidualAmount,
    unappliedAmount: settlement.unappliedAmount,
    postedAt: settlement.postedAt,
    serviceFeeTrusteeStatus: settlement.serviceFeeTrusteeStatus,
    serviceFeeTrusteeSubmittedAt: settlement.serviceFeeTrusteeSubmittedAt,
    serviceFeeTrusteeCompletedAt: settlement.serviceFeeTrusteeCompletedAt,
  };
}

function BucketPayoutCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{formatCurrency(value)}</div>
    </div>
  );
}

const noteActionCopy: Record<
  NoteLifecycleAction,
  { title: string; description: string; confirmLabel: string; successLabel: string; destructive?: boolean }
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
    [
      publishNote.isPending,
      unpublishNote.isPending,
      closeFunding.isPending,
      failFunding.isPending,
    ]
  );

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
                const settlementSummary = getSettlementSummary(note);
                return settlementSummary ? (
                  <Card className="rounded-2xl border-emerald-200 bg-emerald-50/70">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-emerald-950">Settlement Posted</div>
                          <p className="mt-1 text-sm text-emerald-900">
                            This note has been settled and the posted payout has been allocated across the platform buckets.
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          Settled
                        </Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <BucketPayoutCard label="Repayment Pool" value={settlementSummary.grossReceiptAmount} />
                        <BucketPayoutCard label="Investor Pool" value={settlementSummary.investorPoolAmount} />
                        <BucketPayoutCard label="Operating Account" value={settlementSummary.operatingAccountAmount} />
                        <BucketPayoutCard label="Ta'widh Account" value={settlementSummary.tawidhAccountAmount} />
                        <BucketPayoutCard label="Gharamah Account" value={settlementSummary.gharamahAccountAmount} />
                      </div>
                      <div className="text-sm text-emerald-950">
                        Issuer residual refund: {formatCurrency(settlementSummary.issuerResidualAmount)}
                      </div>
                    </CardContent>
                  </Card>
                ) : null;
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
                  <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Featured</span>
                    <Switch
                      id="note-featured-toggle"
                      checked={featuredEnabled}
                      onCheckedChange={(checked) => void handleToggleFeatured(Boolean(checked))}
                      disabled={updateNoteFeatured.isPending}
                    />
                  </div>
                  <NoteStatusBadge note={note} showDetail />
                </div>
              </div>

              <Card className="rounded-2xl">
                <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6">
                  <div>
                    <div className="text-xs text-muted-foreground">Invoice Amount</div>
                    <div className="mt-1 text-xl font-semibold">{formatCurrency(getInvoiceAmount(note))}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Target Amount</div>
                    <div className="mt-1 text-xl font-semibold">{formatCurrency(note.targetAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Funded Amount</div>
                    <div className="mt-1 text-xl font-semibold">{formatCurrency(note.fundedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Funding Progress</div>
                    <div className="mt-1 text-xl font-semibold">{note.fundingPercent.toFixed(1)}%</div>
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
              />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div className="min-w-0 space-y-6">
                  <NoteTermsPanel note={note} />
                  <SettlementPanel note={note} />
                  <LedgerPanel note={note} />
                </div>
                <div className="min-w-0 space-y-6">
                  <SourceApplicationPanel note={note} />
                  <NoteTimelinePanel note={note} />
                </div>
              </div>

              <NoteInvestorsPanel note={note} />
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
  );
}
