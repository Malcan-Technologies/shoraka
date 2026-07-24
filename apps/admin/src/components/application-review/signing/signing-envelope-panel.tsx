/**
 * Admin signing envelope panel for the application review screen. Shows the active
 * package in full detail, collapses prior packages into history, and uses inline
 * Remind actions on the progress matrix (no separate Nudge footer).
 *
 * When embedded in the Acceptance tab, set `showOfferAcceptanceSummary={false}` —
 * phase status + acknowledgements live in AcceptanceSection above this panel.
 * Signing-clock deadline (Complete signing by / Expired) renders here.
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
  getOfferPhaseDeadlineDisplay,
  resolveOfferAcknowledgementsFromWorkflow,
  resolveSigningDeadlineFromWorkflow,
  DEFAULT_SIGNING_DEADLINE,
  addDaysIso,
  type ApplicationPersonRow,
  type SigningEnvelopeDto,
  type SigningEnvelopeStatus,
} from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  useExtendContractSigningDeadline,
  useExtendInvoiceSigningDeadline,
} from "@/hooks/use-application-review-actions";

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

/**
 * Resolve offer_details used for offer_acceptance phase UI.
 * Prefer the invoice tied to the primary envelope when present.
 */
export function resolveAcceptanceOfferDetails(args: {
  primaryEnvelopeInvoiceId?: string | null;
  offerDetails?: unknown;
  invoices?: { id: string; offer_details?: unknown }[];
}): unknown {
  const { primaryEnvelopeInvoiceId, offerDetails, invoices = [] } = args;
  if (primaryEnvelopeInvoiceId) {
    return (
      invoices.find((inv) => inv.id === primaryEnvelopeInvoiceId)?.offer_details ??
      offerDetails ??
      null
    );
  }
  if (offerDetails != null) return offerDetails;
  return invoices.find((inv) => inv.offer_details != null)?.offer_details ?? null;
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
  /**
   * When false, hide the offer-acceptance status/acknowledgements block
   * (Acceptance tab renders that above this panel).
   */
  showOfferAcceptanceSummary?: boolean;
  /** Used for empty-state copy when no offer has been sent yet. */
  structureType?: string | null;
  /** When true, render body only (no Card). Used inside AcceptanceSection. */
  embedded?: boolean;
  signedDocumentPending?: boolean;
  onViewSignedDocument?: (documentId: string) => void;
  onDownloadSignedDocument?: (documentId: string, fileName?: string) => void;
}

export function SigningEnvelopePanel({
  applicationId,
  workflow,
  canManage = true,
  offerDetails,
  invoices = [],
  showOfferAcceptanceSummary = true,
  structureType,
  embedded = false,
  signedDocumentPending = false,
  onViewSignedDocument,
  onDownloadSignedDocument,
}: SigningEnvelopePanelProps) {
  const { data: envelopes = [], isLoading } = useAdminSigningEnvelopes(applicationId);
  const voidMutation = useVoidSigningEnvelope(applicationId);
  const remindMutation = useRemindSigningRecipient(applicationId);
  const extendContractMutation = useExtendContractSigningDeadline();
  const extendInvoiceMutation = useExtendInvoiceSigningDeadline();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [extendConfirmOpen, setExtendConfirmOpen] = React.useState(false);

  const { primary, history } = React.useMemo(() => splitEnvelopes(envelopes), [envelopes]);

  const acceptanceOfferDetails = React.useMemo(
    () =>
      resolveAcceptanceOfferDetails({
        primaryEnvelopeInvoiceId: primary?.invoice_id,
        offerDetails,
        invoices,
      }),
    [primary, offerDetails, invoices]
  );

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

  const isInvoiceOnly = structureType === "invoice_only";
  const noOfferYetHint = isInvoiceOnly
    ? "Send an offer from Invoice to start acceptance."
    : "Send an offer from Contract to start acceptance.";

  const invoiceIdForExtend = React.useMemo(() => {
    if (!isInvoiceOnly) return null;
    if (primary?.invoice_id) return primary.invoice_id;
    const withOffer = invoices.find((inv) => inv.offer_details != null);
    return withOffer?.id ?? null;
  }, [isInvoiceOnly, primary?.invoice_id, invoices]);

  const extendPending = extendContractMutation.isPending || extendInvoiceMutation.isPending;

  const signingExtendPreview = React.useMemo(() => {
    const deadline = resolveSigningDeadlineFromWorkflow(workflow) ?? DEFAULT_SIGNING_DEADLINE;
    const completeByIso = addDaysIso(new Date().toISOString(), deadline.days);
    return {
      days: deadline.days,
      absolute: format(new Date(completeByIso), "dd MMM yyyy, h:mm a"),
    };
  }, [workflow, extendConfirmOpen]);

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

  const handleExtendSigningDeadline = async () => {
    try {
      if (isInvoiceOnly) {
        if (!invoiceIdForExtend) {
          toast.error("No invoice offer found to extend");
          return;
        }
        await extendInvoiceMutation.mutateAsync({
          applicationId,
          invoiceId: invoiceIdForExtend,
        });
      } else {
        await extendContractMutation.mutateAsync({ applicationId });
      }
      toast.success("Signing deadline extended");
      setExtendConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to extend signing deadline");
    }
  };

  const canRemindPrimary =
    canManage &&
    primary != null &&
    (primary.status === "SENT" || primary.status === "IN_PROGRESS");

  const emptySigningMessage = (() => {
    if (acceptance == null) {
      return showOfferAcceptanceSummary
        ? noOfferYetHint
        : "No signing package yet. It appears after the issuer starts signing.";
    }
    if (signingBlocked) {
      return "Signing package is locked until acceptance documents are approved.";
    }
    if (acceptance.status === "COMPLETED") {
      return "No signing package on file for this offer.";
    }
    return "No signing package yet. The issuer creates and sends this package from their offer flow.";
  })();

  const signingDeadlineDisplay =
    acceptance?.status === "APPROVED_FOR_SIGNING" ||
    acceptance?.status === "SIGNING_IN_PROGRESS"
      ? getOfferPhaseDeadlineDisplay(acceptanceOfferDetails)
      : null;

  const showExtendSigningCta =
    canManage && signingDeadlineDisplay?.urgency === "past";

  const body = (
    <div className="space-y-4">
      {signingDeadlineDisplay ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            className={cn(
              "text-sm",
              signingDeadlineDisplay.urgency === "past"
                ? "font-medium text-destructive"
                : signingDeadlineDisplay.urgency === "soon"
                  ? "font-medium text-amber-800"
                  : "text-muted-foreground"
            )}
          >
            {signingDeadlineDisplay.summary}
          </p>
          {showExtendSigningCta ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => setExtendConfirmOpen(true)}
              disabled={extendPending}
            >
              Extend signing deadline
            </Button>
          ) : null}
        </div>
      ) : null}
      {showOfferAcceptanceSummary && acceptancePresentation ? (
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

      {showOfferAcceptanceSummary && !acceptancePresentation ? (
        <p className="text-sm text-muted-foreground">{noOfferYetHint}</p>
      ) : null}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && envelopes.length === 0 && (
        <p className="text-sm text-muted-foreground">{emptySigningMessage}</p>
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
          signedDocumentPending={signedDocumentPending}
          onViewSignedDocument={onViewSignedDocument}
          onDownloadSignedDocument={onDownloadSignedDocument}
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
              <HistoryEnvelopeRow
                key={envelope.id}
                envelope={envelope}
                signedDocumentPending={signedDocumentPending}
                onViewSignedDocument={onViewSignedDocument}
                onDownloadSignedDocument={onDownloadSignedDocument}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <AlertDialog open={extendConfirmOpen} onOpenChange={setExtendConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Extend signing deadline?</AlertDialogTitle>
            <AlertDialogDescription>
              Gives the issuer a new signing window of {signingExtendPreview.days}{" "}
              {signingExtendPreview.days === 1 ? "day" : "days"} from now (Complete signing by{" "}
              {signingExtendPreview.absolute}). Acceptance documents and offer terms stay as they
              are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={extendPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={extendPending}
              onClick={(e) => {
                e.preventDefault();
                void handleExtendSigningDeadline();
              }}
            >
              {extendPending ? "Extending…" : "Extend deadline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg">Signing package</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
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
  signedDocumentPending,
  onViewSignedDocument,
  onDownloadSignedDocument,
}: {
  envelope: SigningEnvelopeDto;
  canManage: boolean;
  canRemind: boolean;
  remindDisabled: boolean;
  voidDisabled: boolean;
  onVoid: () => void;
  onRemind: (recipientId: string) => void;
  signedDocumentPending?: boolean;
  onViewSignedDocument?: (documentId: string) => void;
  onDownloadSignedDocument?: (documentId: string, fileName?: string) => void;
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
        viewDocumentPending={signedDocumentPending}
        onViewSignedDocument={onViewSignedDocument}
        onDownloadSignedDocument={onDownloadSignedDocument}
      />
    </div>
  );
}

/** One-line summary for voided/expired/prior packages; expand only when needed. */
function HistoryEnvelopeRow({
  envelope,
  signedDocumentPending,
  onViewSignedDocument,
  onDownloadSignedDocument,
}: {
  envelope: SigningEnvelopeDto;
  signedDocumentPending?: boolean;
  onViewSignedDocument?: (documentId: string) => void;
  onDownloadSignedDocument?: (documentId: string, fileName?: string) => void;
}) {
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
            <SigningProgressMatrix
              envelope={envelope}
              collapseCompletedDocuments
              compact
              viewDocumentPending={signedDocumentPending}
              onViewSignedDocument={onViewSignedDocument}
              onDownloadSignedDocument={onDownloadSignedDocument}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
