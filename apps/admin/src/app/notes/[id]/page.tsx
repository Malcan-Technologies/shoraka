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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { Skeleton } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { useNoteDetail } from "@/notes/hooks/use-note-detail";
import {
  useActivateNote,
  useCloseNoteFunding,
  useFailNoteFunding,
  usePublishNote,
  useUpdateNoteFeatured,
  useUnpublishNote,
} from "@/notes/hooks/use-notes";
import { LedgerPanel } from "@/notes/components/ledger-panel";
import { NoteTermsPanel } from "@/notes/components/note-terms-panel";
import { NoteTimelinePanel } from "@/notes/components/note-timeline-panel";
import { SettlementPanel } from "@/notes/components/settlement-panel";
import { SourceApplicationPanel } from "@/notes/components/source-application-panel";
import { formatNoteStatus } from "@/notes/utils/format-note-status";
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

function formatStatus(value: string) {
  return formatNoteStatus(value);
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

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - timezoneOffsetMs);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

type ConfirmableNoteAction = "publish" | "unpublish" | "closeFunding" | "failFunding";

const noteActionCopy: Record<
  ConfirmableNoteAction,
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
      "This will stop new marketplace commitments and prepare investor allocations for activation. Confirm that the funding result is ready to be locked.",
    confirmLabel: "Close Funding",
    successLabel: "Funding closed",
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
  const activateNote = useActivateNote();
  const updateNoteFeatured = useUpdateNoteFeatured();
  const [pendingAction, setPendingAction] = React.useState<ConfirmableNoteAction | null>(null);
  const [featuredEnabled, setFeaturedEnabled] = React.useState(false);
  const [featuredRank, setFeaturedRank] = React.useState("");
  const [featuredFrom, setFeaturedFrom] = React.useState("");
  const [featuredUntil, setFeaturedUntil] = React.useState("");

  const handleAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const runConfirmedAction = async () => {
    if (!note || !pendingAction) return;
    const copy = noteActionCopy[pendingAction];
    const actions: Record<ConfirmableNoteAction, () => Promise<unknown>> = {
      publish: () => publishNote.mutateAsync(note.id),
      unpublish: () => unpublishNote.mutateAsync(note.id),
      closeFunding: () => closeFunding.mutateAsync(note.id),
      failFunding: () => failFunding.mutateAsync(note.id),
    };

    await handleAction(copy.successLabel, actions[pendingAction]);
    setPendingAction(null);
  };

  const handlePublish = async () => {
    if (!note) return;
    setPendingAction("publish");
  };

  const handleUnpublish = async () => {
    if (!note) return;
    setPendingAction("unpublish");
  };

  const confirmCopy = pendingAction ? noteActionCopy[pendingAction] : null;
  const confirmPending =
    publishNote.isPending || unpublishNote.isPending || closeFunding.isPending || failFunding.isPending;
  const publishableListingStatuses = ["NOT_LISTED", "DRAFT", "UNPUBLISHED"];
  const canPublish =
    note?.status === "DRAFT" &&
    note.fundingStatus === "NOT_OPEN" &&
    publishableListingStatuses.includes(note.listingStatus);
  const canUnpublish =
    note?.status === "PUBLISHED" &&
    note.listingStatus === "PUBLISHED" &&
    note.fundingStatus === "OPEN" &&
    note.investments.length === 0;
  const isFundingOpen = note?.status === "PUBLISHED" && note.fundingStatus === "OPEN";
  const meetsMinimumFunding =
    note != null && note.fundingPercent + 0.005 >= note.minimumFundingPercent;
  const canCloseFunding = Boolean(isFundingOpen && meetsMinimumFunding);
  const canFailFunding = Boolean(isFundingOpen && !meetsMinimumFunding);
  const canActivate =
    note?.status === "FUNDING" &&
    note.fundingStatus === "FUNDED" &&
    note.servicingStatus === "NOT_STARTED";

  React.useEffect(() => {
    if (!note) return;
    setFeaturedEnabled(note.isFeatured);
    setFeaturedRank(note.featuredRank != null ? String(note.featuredRank) : "");
    setFeaturedFrom(toDateTimeLocal(note.featuredFrom));
    setFeaturedUntil(toDateTimeLocal(note.featuredUntil));
  }, [note]);

  const isFeaturedDirty =
    note != null &&
    (featuredEnabled !== note.isFeatured ||
      (featuredRank.trim() === "" ? null : Number(featuredRank)) !== note.featuredRank ||
      fromDateTimeLocal(featuredFrom) !== note.featuredFrom ||
      fromDateTimeLocal(featuredUntil) !== note.featuredUntil);

  const handleSaveFeatured = async () => {
    if (!note) return;
    if (featuredEnabled && featuredRank.trim() !== "" && !Number.isInteger(Number(featuredRank))) {
      toast.error("Featured rank must be a whole number");
      return;
    }
    if (featuredEnabled && featuredFrom && !fromDateTimeLocal(featuredFrom)) {
      toast.error("Featured start datetime is invalid");
      return;
    }
    if (featuredEnabled && featuredUntil && !fromDateTimeLocal(featuredUntil)) {
      toast.error("Featured end datetime is invalid");
      return;
    }
    try {
      await updateNoteFeatured.mutateAsync({
        id: note.id,
        input: {
          isFeatured: featuredEnabled,
          featuredRank: featuredEnabled && featuredRank.trim() !== "" ? Number(featuredRank) : null,
          featuredFrom: featuredEnabled ? fromDateTimeLocal(featuredFrom) : null,
          featuredUntil: featuredEnabled ? fromDateTimeLocal(featuredUntil) : null,
        },
      });
      toast.success("Featured settings updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update featured settings");
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
                        <Badge variant="secondary">Settled</Badge>
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

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge variant="outline">{formatStatus(note.status)}</Badge>
                  <Badge variant="secondary">{formatStatus(note.listingStatus)}</Badge>
                  <Badge variant="secondary">{formatStatus(note.fundingStatus)}</Badge>
                  <Badge variant="secondary">{formatStatus(note.servicingStatus)}</Badge>
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

              <Card className="rounded-2xl">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold">Featured Marketplace Placement</h3>
                      <p className="text-sm text-muted-foreground">
                        Curate this note for featured slots with rank and schedule controls.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="note-featured-toggle" className="text-sm">Featured</Label>
                      <Switch
                        id="note-featured-toggle"
                        checked={featuredEnabled}
                        onCheckedChange={setFeaturedEnabled}
                        disabled={updateNoteFeatured.isPending}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="note-featured-rank">Priority Rank</Label>
                      <Input
                        id="note-featured-rank"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="e.g. 1"
                        value={featuredRank}
                        onChange={(event) => setFeaturedRank(event.target.value)}
                        disabled={!featuredEnabled || updateNoteFeatured.isPending}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="note-featured-from">Featured From</Label>
                      <Input
                        id="note-featured-from"
                        type="datetime-local"
                        value={featuredFrom}
                        onChange={(event) => setFeaturedFrom(event.target.value)}
                        disabled={!featuredEnabled || updateNoteFeatured.isPending}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="note-featured-until">Featured Until</Label>
                      <Input
                        id="note-featured-until"
                        type="datetime-local"
                        value={featuredUntil}
                        onChange={(event) => setFeaturedUntil(event.target.value)}
                        disabled={!featuredEnabled || updateNoteFeatured.isPending}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSaveFeatured()}
                      disabled={!isFeaturedDirty || updateNoteFeatured.isPending}
                    >
                      {updateNoteFeatured.isPending ? "Saving..." : "Save Featured Settings"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishNote.isPending || !canPublish}
                >
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnpublish}
                  disabled={unpublishNote.isPending || !canUnpublish}
                >
                  Unpublish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingAction("closeFunding")}
                  disabled={closeFunding.isPending || !canCloseFunding}
                >
                  Close Funding
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingAction("failFunding")}
                  disabled={failFunding.isPending || !canFailFunding}
                >
                  Fail Funding
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleAction("Note activated", () => activateNote.mutateAsync(note.id))
                  }
                  disabled={activateNote.isPending || !canActivate}
                >
                  Activate
                </Button>
              </div>

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
