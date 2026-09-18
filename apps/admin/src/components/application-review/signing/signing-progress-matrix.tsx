/**
 * Document-grouped signing checklist with per-signer status rows.
 * When a document has a signed PDF, optional View / Download actions sit on the header.
 */
"use client";

import * as React from "react";
import { Progress, StatusBadge } from "@cashsouk/ui";
import {
  automaticSigningProgressBadge,
  computeSigningEnvelopeProgress,
  isRemindableSigningRecipient,
  isShorakaSigningRecipient,
  signingRecipientDisplayTitle,
  type SigningAssignmentDto,
  type SigningAssignmentStatus,
  type SigningEnvelopeDto,
} from "@cashsouk/types";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  EyeIcon,
  PaperAirplaneIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";

const STATUS_META: Record<
  SigningAssignmentStatus,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: { label: "Pending", Icon: ClockIcon },
  SENT: { label: "Email sent", Icon: PaperAirplaneIcon },
  VIEWED: { label: "Viewed", Icon: EyeIcon },
  SIGNED: { label: "Signed", Icon: CheckCircleIcon },
  DECLINED: { label: "Declined", Icon: XCircleIcon },
};

const SIGNED_DOC_ACTION_BTN_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-xs";

type SigningProgressMatrixProps = {
  envelope: SigningEnvelopeDto;
  onRemind?: (recipientId: string, documentId: string) => void;
  remindDisabled?: boolean;
  showRemindActions?: boolean;
  onRetryAutoSign?: (assignmentId: string) => void;
  retryDisabled?: boolean;
  /** Collapse fully-signed document groups by default. */
  collapseCompletedDocuments?: boolean;
  /** Tighter row padding for dense admin review. */
  compact?: boolean;
  viewDocumentPending?: boolean;
  onViewSignedDocument?: (documentId: string) => void;
  onDownloadSignedDocument?: (documentId: string, fileName?: string) => void;
};

function SignedDocumentActions({
  documentId,
  fileName,
  pending,
  onView,
  onDownload,
}: {
  documentId: string;
  fileName: string;
  pending?: boolean;
  onView?: (documentId: string) => void;
  onDownload?: (documentId: string, fileName?: string) => void;
}) {
  if (!onView && !onDownload) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {onView ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={SIGNED_DOC_ACTION_BTN_CLASS}
          disabled={pending}
          onClick={() => onView(documentId)}
        >
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" />
          View
        </Button>
      ) : null}
      {onDownload ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={SIGNED_DOC_ACTION_BTN_CLASS}
          disabled={pending}
          onClick={() => onDownload(documentId, fileName)}
        >
          <ArrowDownTrayIcon className="h-3.5 w-3.5 shrink-0" />
          Download
        </Button>
      ) : null}
    </div>
  );
}

export function SigningProgressMatrix({
  envelope,
  onRemind,
  remindDisabled = false,
  showRemindActions = false,
  onRetryAutoSign,
  retryDisabled = false,
  collapseCompletedDocuments = false,
  compact = false,
  viewDocumentPending = false,
  onViewSignedDocument,
  onDownloadSignedDocument,
}: SigningProgressMatrixProps) {
  const progress = React.useMemo(() => computeSigningEnvelopeProgress(envelope), [envelope]);

  const recipientById = React.useMemo(
    () => new Map(envelope.recipients.map((recipient) => [recipient.id, recipient])),
    [envelope.recipients]
  );

  const assignmentsByDocument = React.useMemo(() => {
    const map = new Map<string, SigningAssignmentDto[]>();
    for (const document of envelope.documents) {
      const assignments = envelope.assignments
        .filter((assignment) => assignment.document_id === document.id && assignment.required)
        .sort((a, b) => {
          const recipientA = recipientById.get(a.recipient_id);
          const recipientB = recipientById.get(b.recipient_id);
          return (recipientA?.routing_order ?? 0) - (recipientB?.routing_order ?? 0);
        });
      map.set(document.id, assignments);
    }
    return map;
  }, [envelope.assignments, envelope.documents, recipientById]);

  if (envelope.documents.length === 0 || envelope.recipients.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents or recipients yet.</p>;
  }

  const rowPad = compact ? "px-3 py-2" : "px-4 py-3";
  const headerPad = compact ? "px-3 py-2" : "px-4 py-3";
  const iconSize = compact ? "h-7 w-7" : "h-8 w-8";

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div className="flex items-center gap-3">
        <Progress
          value={progress.percent}
          className={cn(
            "h-2 flex-1",
            progress.percent >= 100 && "bg-status-success-bg"
          )}
          indicatorClassName={
            progress.percent >= 100 ? "bg-status-success-text" : undefined
          }
        />
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {progress.signed}/{progress.total_required} signed ({progress.percent}%)
        </span>
      </div>

      <div className={cn("space-y-3", compact && "space-y-2")}>
        {envelope.documents.map((document) => {
          const assignments = assignmentsByDocument.get(document.id) ?? [];
          const signedCount = assignments.filter((assignment) => assignment.status === "SIGNED").length;
          const allSigned = assignments.length > 0 && signedCount === assignments.length;
          const duplicateNames =
            new Set(
              assignments
                .map((assignment) => recipientById.get(assignment.recipient_id)?.name)
                .filter((name): name is string => Boolean(name))
            ).size < assignments.length;

          const signedActions =
            document.has_signed_pdf && (onViewSignedDocument || onDownloadSignedDocument) ? (
              <SignedDocumentActions
                documentId={document.id}
                fileName={`${document.name}.pdf`}
                pending={viewDocumentPending}
                onView={onViewSignedDocument}
                onDownload={onDownloadSignedDocument}
              />
            ) : null;

          const body =
            assignments.length === 0 ? (
              <p className={cn(rowPad, "text-sm text-muted-foreground")}>No signers assigned.</p>
            ) : (
              <ul className="divide-y divide-border">
                {assignments.map((assignment) => {
                  const recipient = recipientById.get(assignment.recipient_id);
                  if (!recipient) return null;

                  const isAutomatic = recipient.execution_mode === "AUTOMATIC";
                  const title = signingRecipientDisplayTitle(recipient, duplicateNames);
                  const automaticBadge = isAutomatic
                    ? automaticSigningProgressBadge(assignment.status)
                    : null;
                  const meta = STATUS_META[assignment.status];
                  const StatusIcon = meta.Icon;
                  const isSigned = assignment.status === "SIGNED";
                  const canRemind =
                    !isAutomatic &&
                    showRemindActions &&
                    onRemind != null &&
                    isRemindableSigningRecipient(recipient) &&
                    assignment.status !== "DECLINED" &&
                    !isSigned;
                  const autoSignError =
                    isAutomatic && !isSigned ? assignment.auto_sign_error?.trim() || null : null;
                  const canRetry =
                    Boolean(autoSignError) && onRetryAutoSign != null && !isSigned;

                  const badgeSize = compact ? "sm" : "default";

                  return (
                    <li
                      key={assignment.id}
                      className={cn("flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2", rowPad)}
                    >
                      <div className="flex min-w-52 flex-1 items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex shrink-0 items-center justify-center",
                            iconSize
                          )}
                        >
                          {isSigned ? (
                            <div
                              className={cn(
                                "flex items-center justify-center rounded-full bg-primary",
                                iconSize
                              )}
                            >
                              <CheckIcon className="h-4 w-4 text-primary-foreground" />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "flex items-center justify-center rounded-full border-2 border-border bg-background",
                                iconSize
                              )}
                            >
                              <StatusIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="min-w-0 truncate text-sm font-medium text-foreground">
                              {recipient.name}
                            </p>
                            {isShorakaSigningRecipient(recipient) ? (
                              <StatusBadge
                                label="Shoraka"
                                status="submitted"
                                showDot={false}
                                size={badgeSize}
                                className="shrink-0"
                              />
                            ) : null}
                          </div>
                          {title ? (
                            <p className="truncate text-meta text-muted-foreground">{title}</p>
                          ) : null}
                          {recipient.warning_accepted_at ? (
                            <p className="truncate text-meta text-muted-foreground">
                              Warning accepted
                            </p>
                          ) : null}
                          {autoSignError ? (
                            <p className="break-words text-meta text-status-rejected-text">
                              {autoSignError}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5">
                        <StatusBadge
                          label={automaticBadge?.label ?? meta.label}
                          status={
                            autoSignError
                              ? "action"
                              : (automaticBadge?.status ?? getAdminStatusToken(assignment.status))
                          }
                          size={badgeSize}
                          className="max-w-full"
                        />
                        {canRemind ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={remindDisabled}
                            onClick={() => onRemind(recipient.id, document.id)}
                          >
                            Remind
                          </Button>
                        ) : null}
                        {canRetry ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-ui"
                            disabled={retryDisabled}
                            onClick={() => onRetryAutoSign(assignment.id)}
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );

          if (collapseCompletedDocuments && allSigned) {
            return (
              <CompletedDocumentGroup
                key={document.id}
                name={document.name}
                signedCount={signedCount}
                total={assignments.length}
                headerPad={headerPad}
                signedActions={signedActions}
              >
                {body}
              </CompletedDocumentGroup>
            );
          }

          return (
            <div
              key={document.id}
              className="overflow-hidden rounded-xl border border-border bg-background"
            >
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30",
                  headerPad
                )}
              >
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {document.name}
                </p>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {signedActions}
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {signedCount}/{assignments.length} signed
                  </span>
                </div>
              </div>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompletedDocumentGroup({
  name,
  signedCount,
  total,
  headerPad,
  signedActions,
  children,
}: {
  name: string;
  signedCount: number;
  total: number;
  headerPad: string;
  signedActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-2 bg-muted/20",
            headerPad
          )}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-52 flex-1 items-center justify-between gap-3 text-left hover:opacity-90"
            >
              <div className="flex min-w-0 items-center gap-2">
                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180"
                  )}
                />
                <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-status-success-text" />
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {signedCount}/{total} signed
              </span>
            </button>
          </CollapsibleTrigger>
          {signedActions ? <div className="ml-auto shrink-0">{signedActions}</div> : null}
        </div>
        <CollapsibleContent>
          <div className="border-t border-border">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
