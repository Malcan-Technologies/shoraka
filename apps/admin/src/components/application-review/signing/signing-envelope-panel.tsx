/**
 * Admin signing envelope panel for the application review screen. Shows the active
 * package in full detail, collapses prior packages into history, and exposes
 * Send reminders for live packages (plus per-signer Remind on the progress matrix).
 *
 * When embedded in the Acceptance tab, set `showOfferAcceptanceSummary={false}` —
 * phase status lives in AcceptanceSection above this panel.
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
  useSendAdminSigningPackage,
  useVoidSigningEnvelope,
  useRemindSigningRecipient,
} from "@/hooks/use-signing-envelopes";
import {
  computeSigningEnvelopeProgress,
  computePhaseDeadlineExpiresAt,
  formatPhaseDeadlineAbsolute,
  getOfferAcceptanceFromOfferDetails,
  getOfferAcceptanceStatusPresentation,
  getOfferPhaseDeadlineDisplay,
  hasEnvelopeBlockingNewSend,
  resolveSigningDeadlineFromWorkflow,
  DEFAULT_SIGNING_DEADLINE,
  type SigningEnvelopeDto,
  type SigningEnvelopeStatus,
  toTitleCase,
} from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  /** Product.workflow JSON — signing deadline config. */
  workflow: unknown;
  /** Whether the admin can manage void/reminder actions for this application's signing. */
  canManage?: boolean;
  /** offer_details from the contract this application's offer belongs to (contract-based structures). */
  offerDetails?: unknown;
  /** Standalone invoices (invoice_only structure) — each carries its own offer_details. */
  invoices?: { id: string; offer_details?: unknown }[];
  /**
   * When false, hide the offer-acceptance status block
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
  const sendMutation = useSendAdminSigningPackage(applicationId);
  const voidMutation = useVoidSigningEnvelope(applicationId);
  const remindMutation = useRemindSigningRecipient(applicationId);
  const extendContractMutation = useExtendContractSigningDeadline();
  const extendInvoiceMutation = useExtendInvoiceSigningDeadline();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [extendConfirmOpen, setExtendConfirmOpen] = React.useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = React.useState(false);

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
  const signingBlocked =
    acceptance != null &&
    acceptance.status !== "APPROVED_FOR_SIGNING" &&
    acceptance.status !== "SIGNING_IN_PROGRESS" &&
    acceptance.status !== "COMPLETED";

  const isInvoiceOnly = structureType === "invoice_only";
  const noOfferYetHint = isInvoiceOnly
    ? "Send an offer from Invoice to start acceptance."
    : "Send an offer from Facility to start acceptance.";

  const invoiceIdForExtend = React.useMemo(() => {
    if (!isInvoiceOnly) return null;
    if (primary?.invoice_id) return primary.invoice_id;
    const withOffer = invoices.find((inv) => inv.offer_details != null);
    return withOffer?.id ?? null;
  }, [isInvoiceOnly, primary?.invoice_id, invoices]);

  const extendPending = extendContractMutation.isPending || extendInvoiceMutation.isPending;

  const signingExtendPreview = React.useMemo(() => {
    const deadline = resolveSigningDeadlineFromWorkflow(workflow) ?? DEFAULT_SIGNING_DEADLINE;
    const completeByIso = computePhaseDeadlineExpiresAt(new Date().toISOString(), deadline.days);
    return {
      days: deadline.days,
      absolute: formatPhaseDeadlineAbsolute(completeByIso),
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

  const handleResendReminders = async () => {
    if (!primary) return;
    const unsigned = primary.recipients.filter(
      (recipient) => recipient.status !== "SIGNED" && recipient.status !== "DECLINED"
    );
    if (unsigned.length === 0) {
      toast.info("All signers have already signed.");
      return;
    }
    try {
      for (const recipient of unsigned) {
        await remindMutation.mutateAsync({ envelopeId: primary.id, recipientId: recipient.id });
      }
      toast.success(
        unsigned.length === 1
          ? `Reminder sent to ${unsigned[0].name}`
          : `Reminders sent to ${unsigned.length} signers`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reminders");
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

  const handleSendSigningLinks = async () => {
    try {
      await sendMutation.mutateAsync(
        isInvoiceOnly ? { invoiceId: invoiceIdForExtend } : {}
      );
      toast.success("Signing links sent to the authorised representatives");
      setSendConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send signing links");
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
        : "No signing package yet. Send an offer to start acceptance.";
    }
    if (signingBlocked) {
      return "Signing package is locked until acceptance documents and authorised representatives are approved.";
    }
    if (acceptance.status === "COMPLETED") {
      return "No signing package on file for this offer.";
    }
    if (acceptance.status === "APPROVED_FOR_SIGNING") {
      return "Acceptance is approved. Send signing links to the authorised representatives.";
    }
    return "No signing package yet.";
  })();

  const signingDeadlineDisplay =
    acceptance?.status === "SIGNING_IN_PROGRESS"
      ? getOfferPhaseDeadlineDisplay(acceptanceOfferDetails)
      : null;

  const showExtendSigningCta =
    canManage && signingDeadlineDisplay?.urgency === "past";

  const signingClockPast = signingDeadlineDisplay?.urgency === "past";
  const canSendSigningLinks =
    canManage &&
    acceptance?.status === "APPROVED_FOR_SIGNING" &&
    !signingClockPast &&
    !hasEnvelopeBlockingNewSend(envelopes) &&
    (!isInvoiceOnly || Boolean(invoiceIdForExtend));

  const sendPending = sendMutation.isPending;

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
      {showOfferAcceptanceSummary && acceptance && acceptancePresentation ? (
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">Offer acceptance</span>
            <StatusBadge
              label={acceptancePresentation.label}
              status={getAdminStatusToken(acceptance.status)}
            />
          </div>
        </div>
      ) : null}

      {showOfferAcceptanceSummary && !acceptancePresentation ? (
        <p className="text-sm text-muted-foreground">{noOfferYetHint}</p>
      ) : null}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && envelopes.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{emptySigningMessage}</p>
          {canSendSigningLinks ? (
            <Button
              type="button"
              size="sm"
              className="rounded-lg"
              onClick={() => setSendConfirmOpen(true)}
              disabled={sendPending}
            >
              Send signing links
            </Button>
          ) : null}
        </div>
      )}

      {!isLoading && envelopes.length > 0 && canSendSigningLinks ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Previous packages were voided. Send new signing links to the authorised representatives.
          </p>
          <Button
            type="button"
            size="sm"
            className="rounded-lg"
            onClick={() => setSendConfirmOpen(true)}
            disabled={sendPending}
          >
            Send signing links
          </Button>
        </div>
      ) : null}

      {primary ? (
        <ActiveEnvelopeCard
          envelope={primary}
          canManage={canManage}
          canRemind={canRemindPrimary}
          remindDisabled={remindMutation.isPending}
          voidDisabled={voidMutation.isPending}
          onVoid={() => handleVoid(primary.id)}
          onRemind={(recipientId) => handleRemind(primary.id, recipientId)}
          onResendReminders={canRemindPrimary ? handleResendReminders : undefined}
          onSendDraft={
            canManage &&
            primary.status === "DRAFT" &&
            acceptance?.status === "APPROVED_FOR_SIGNING" &&
            !signingClockPast
              ? () => setSendConfirmOpen(true)
              : undefined
          }
          sendPending={sendPending}
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

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Send signing links?</AlertDialogTitle>
            <AlertDialogDescription>
              Sends secure signing emails to the authorised representatives already approved
              with this offer. They cannot be changed without requesting changes to the
              representative lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={sendPending}
              onClick={(e) => {
                e.preventDefault();
                void handleSendSigningLinks();
              }}
            >
              {sendPending ? "Sending…" : "Send links"}
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
  onResendReminders,
  onSendDraft,
  sendPending,
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
  onResendReminders?: () => void;
  onSendDraft?: () => void;
  sendPending?: boolean;
  signedDocumentPending?: boolean;
  onViewSignedDocument?: (documentId: string) => void;
  onDownloadSignedDocument?: (documentId: string, fileName?: string) => void;
}) {
  const canVoid =
    canManage && envelope.status !== "COMPLETED" && envelope.status !== "VOIDED";
  const unsignedCount = envelope.recipients.filter(
    (recipient) => recipient.status !== "SIGNED" && recipient.status !== "DECLINED"
  ).length;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-medium">{envelope.title}</span>
          <StatusBadge
            label={toTitleCase(envelope.status.replace(/_/g, " "))}
            status={getAdminStatusToken(envelope.status)}
          />
        </div>
        {canVoid ? (
          <Button size="sm" variant="outline" onClick={onVoid} disabled={voidDisabled}>
            Void
          </Button>
        ) : null}
      </div>

      {envelope.status === "DRAFT" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            This package was not sent. Send the signing links, or void it to start over.
          </p>
          {onSendDraft ? (
            <Button
              type="button"
              size="sm"
              className="rounded-lg"
              onClick={onSendDraft}
              disabled={sendPending}
            >
              {sendPending ? "Sending…" : "Send signing links"}
            </Button>
          ) : null}
        </div>
      ) : null}

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

      {onResendReminders && unsignedCount > 0 ? (
        <Button
          type="button"
          size="sm"
          className="rounded-lg"
          onClick={onResendReminders}
          disabled={remindDisabled}
        >
          {remindDisabled ? "Sending reminders…" : "Send reminders"}
        </Button>
      ) : null}
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
            <StatusBadge
              label={toTitleCase(envelope.status.replace(/_/g, " "))}
              status={getAdminStatusToken(envelope.status)}
            />
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
