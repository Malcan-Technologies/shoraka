/**
 * Admin signing envelope panel for the application review screen. Shows the active
 * package in full detail, collapses prior packages into history, and uses inline
 * Remind actions on the progress matrix (no separate Nudge footer).
 */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { SigningProgressMatrix } from "./signing-progress-matrix";
import {
  useAdminSigningEnvelopes,
  useVoidSigningEnvelope,
  useRemindSigningRecipient,
} from "@/hooks/use-signing-envelopes";
import {
  computeSigningEnvelopeProgress,
  getOfferAcceptanceFromOfferDetails,
  getOfferAcceptanceStatusPresentation,
  resolveOfferAcknowledgementsFromWorkflow,
  type ApplicationPersonRow,
  type SigningEnvelopeDto,
  type SigningEnvelopeStatus,
} from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<SigningEnvelopeStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-primary/10 text-primary",
  VOIDED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
};

const LIVE_STATUSES = new Set<SigningEnvelopeStatus>(["DRAFT", "SENT", "IN_PROGRESS"]);

function envelopeTimestamp(envelope: SigningEnvelopeDto): number {
  const raw = envelope.completed_at ?? envelope.sent_at ?? null;
  return raw ? new Date(raw).getTime() : 0;
}

function formatEnvelopeWhen(envelope: SigningEnvelopeDto): string | null {
  const raw = envelope.completed_at ?? envelope.sent_at;
  if (!raw) return null;
  try {
    return format(new Date(raw), "d MMM yyyy");
  } catch {
    return null;
  }
}

/** Prefer a live package; otherwise the newest completed one is the primary surface. */
function splitEnvelopes(envelopes: SigningEnvelopeDto[]): {
  primary: SigningEnvelopeDto | null;
  history: SigningEnvelopeDto[];
} {
  const sorted = [...envelopes].sort((a, b) => envelopeTimestamp(b) - envelopeTimestamp(a));
  const live = sorted.find((envelope) => LIVE_STATUSES.has(envelope.status));
  if (live) {
    return {
      primary: live,
      history: sorted.filter((envelope) => envelope.id !== live.id),
    };
  }
  const completed = sorted.find((envelope) => envelope.status === "COMPLETED");
  if (completed) {
    return {
      primary: completed,
      history: sorted.filter((envelope) => envelope.id !== completed.id),
    };
  }
  return { primary: sorted[0] ?? null, history: sorted.slice(1) };
}

export interface SigningEnvelopePanelProps {
  applicationId: string;
  /** Product.workflow JSON — used to resolve offer acknowledgement document names. */
  workflow: unknown;
  people: ApplicationPersonRow[];
  guarantors: unknown;
  contractId?: string | null;
  invoiceId?: string | null;
  productVersion?: number | null;
  /** Whether the admin can manage void/reminder actions for this application's signing. */
  canManage?: boolean;
  /** offer_details from the contract this application's offer belongs to (contract-based structures). */
  offerDetails?: unknown;
  /** Standalone invoices (invoice_only structure) — each carries its own offer_details. */
  invoices?: { id: string; offer_details?: unknown }[];
}

export function SigningEnvelopePanel({
  applicationId,
  workflow,
  canManage = true,
  offerDetails,
  invoices = [],
}: SigningEnvelopePanelProps) {
  const { data: envelopes = [], isLoading } = useAdminSigningEnvelopes(applicationId);
  const voidMutation = useVoidSigningEnvelope(applicationId);
  const remindMutation = useRemindSigningRecipient(applicationId);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const { primary, history } = React.useMemo(() => splitEnvelopes(envelopes), [envelopes]);

  /**
   * Invoice-only applications have no contract offer — each invoice carries its own
   * offer_details. Prefer the invoice tied to the primary envelope; otherwise fall back to
   * the contract offer, or the first invoice offer available.
   */
  const acceptanceOfferDetails = React.useMemo(() => {
    if (primary?.invoice_id) {
      return invoices.find((inv) => inv.id === primary.invoice_id)?.offer_details ?? offerDetails ?? null;
    }
    if (offerDetails != null) return offerDetails;
    return invoices.find((inv) => inv.offer_details != null)?.offer_details ?? null;
  }, [primary, offerDetails, invoices]);

  const acceptance = getOfferAcceptanceFromOfferDetails(acceptanceOfferDetails);
  const acceptancePresentation = acceptance
    ? getOfferAcceptanceStatusPresentation(acceptance.status)
    : null;
  const acknowledgementNameByKey = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of resolveOfferAcknowledgementsFromWorkflow(workflow)) {
      map.set(doc.key, doc.name);
    }
    return map;
  }, [workflow]);
  const signingBlocked =
    acceptance != null &&
    acceptance.status !== "APPROVED_FOR_SIGNING" &&
    acceptance.status !== "SIGNING_IN_PROGRESS" &&
    acceptance.status !== "COMPLETED";

  const handleVoid = async (envelopeId: string) => {
    try {
      await voidMutation.mutateAsync({ envelopeId });
      toast.success("Signing package voided");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to void");
    }
  };

  const handleRemind = async (envelopeId: string, recipientId: string) => {
    try {
      await remindMutation.mutateAsync({ envelopeId, recipientId });
      toast.success("Reminder sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remind");
    }
  };

  const canRemindPrimary =
    canManage &&
    primary != null &&
    (primary.status === "SENT" || primary.status === "IN_PROGRESS");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Signing package</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {acceptancePresentation ? (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">Offer acceptance</span>
              <Badge variant="secondary">{acceptancePresentation.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{acceptancePresentation.hint}</p>
            {acceptance?.acknowledgements?.length ? (
              <ul className="mt-1 space-y-1 border-t border-border/60 pt-2">
                {acceptance.acknowledgements.map((ack) => (
                  <li
                    key={ack.document_key}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-foreground">
                      {acknowledgementNameByKey.get(ack.document_key) ?? ack.document_key}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Acknowledged {format(new Date(ack.accepted_at), "d MMM yyyy, h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && envelopes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {signingBlocked
              ? "Signing package is locked until acceptance documents are approved."
              : "No signing package yet. The issuer creates and sends this package from their offer flow."}
          </p>
        )}

        {primary ? (
          <ActiveEnvelopeCard
            envelope={primary}
            canManage={canManage}
            canRemind={canRemindPrimary}
            remindDisabled={remindMutation.isPending}
            voidDisabled={voidMutation.isPending}
            onVoid={() => handleVoid(primary.id)}
            onRemind={(recipientId) => handleRemind(primary.id, recipientId)}
          />
        ) : null}

        {history.length > 0 ? (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <span>Package history ({history.length})</span>
                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    historyOpen && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {history.map((envelope) => (
                <HistoryEnvelopeRow key={envelope.id} envelope={envelope} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActiveEnvelopeCard({
  envelope,
  canManage,
  canRemind,
  remindDisabled,
  voidDisabled,
  onVoid,
  onRemind,
}: {
  envelope: SigningEnvelopeDto;
  canManage: boolean;
  canRemind: boolean;
  remindDisabled: boolean;
  voidDisabled: boolean;
  onVoid: () => void;
  onRemind: (recipientId: string) => void;
}) {
  const canVoid =
    canManage && envelope.status !== "COMPLETED" && envelope.status !== "VOIDED";

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-medium">{envelope.title}</span>
          <Badge className={STATUS_STYLES[envelope.status]}>
            {envelope.status.replace(/_/g, " ")}
          </Badge>
        </div>
        {canVoid ? (
          <Button size="sm" variant="outline" onClick={onVoid} disabled={voidDisabled}>
            Void
          </Button>
        ) : null}
      </div>

      <SigningProgressMatrix
        envelope={envelope}
        collapseCompletedDocuments
        compact
        showRemindActions={canRemind}
        onRemind={onRemind}
        remindDisabled={remindDisabled}
      />
    </div>
  );
}

/** One-line summary for voided/expired/prior packages; expand only when needed. */
function HistoryEnvelopeRow({ envelope }: { envelope: SigningEnvelopeDto }) {
  const [open, setOpen] = React.useState(false);
  const progress = React.useMemo(() => computeSigningEnvelopeProgress(envelope), [envelope]);
  const when = formatEnvelopeWhen(envelope);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-muted/20">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
          >
            <ChevronDownIcon
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{envelope.title}</span>
            <Badge className={cn("shrink-0 font-normal", STATUS_STYLES[envelope.status])}>
              {envelope.status.replace(/_/g, " ")}
            </Badge>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {progress.signed}/{progress.total_required} signed
              {when ? ` · ${when}` : ""}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-3 py-3">
            <SigningProgressMatrix envelope={envelope} collapseCompletedDocuments compact />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
