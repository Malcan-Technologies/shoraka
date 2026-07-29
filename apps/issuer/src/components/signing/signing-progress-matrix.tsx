/**
 * Document-grouped signing checklist with per-signer status rows.
 * Replaces the documents × recipients matrix for clearer progress when signers repeat.
 */
"use client";

import * as React from "react";
import { Progress } from "@cashsouk/ui";
import {
  computeSigningEnvelopeProgress,
  type SigningAssignmentDto,
  type SigningAssignmentStatus,
  type SigningEnvelopeDto,
  type SigningRecipientDto,
} from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  PaperAirplaneIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";

const STATUS_META: Record<
  SigningAssignmentStatus,
  { label: string; badgeClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: "Pending",
    badgeClass: "border-transparent bg-status-neutral-bg text-status-neutral-text",
    Icon: ClockIcon,
  },
  SENT: {
    label: "Email sent",
    badgeClass: "border-transparent bg-status-action-bg text-status-action-text",
    Icon: PaperAirplaneIcon,
  },
  VIEWED: {
    label: "Viewed",
    badgeClass: "border-transparent bg-status-in-progress-bg text-status-in-progress-text",
    Icon: EyeIcon,
  },
  SIGNED: {
    label: "Signed",
    badgeClass:
      "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
    Icon: CheckCircleIcon,
  },
  DECLINED: {
    label: "Declined",
    badgeClass: "border-transparent bg-status-rejected-bg text-status-rejected-text",
    Icon: XCircleIcon,
  },
};

type SigningProgressMatrixProps = {
  envelope: SigningEnvelopeDto;
  onRemind?: (recipientId: string) => void;
  remindDisabled?: boolean;
  showRemindActions?: boolean;
};

function recipientLabel(recipient: SigningRecipientDto, showEmail: boolean): string {
  if (showEmail) return recipient.email;
  return recipient.role_label || recipient.role_key;
}

export function SigningProgressMatrix({
  envelope,
  onRemind,
  remindDisabled = false,
  showRemindActions = false,
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

  return (
    <div className="space-y-4">
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

      <div className="space-y-3">
        {envelope.documents.map((document) => {
          const assignments = assignmentsByDocument.get(document.id) ?? [];
          const signedCount = assignments.filter((assignment) => assignment.status === "SIGNED").length;
          const duplicateNames = new Set(
            assignments
              .map((assignment) => recipientById.get(assignment.recipient_id)?.name)
              .filter((name): name is string => Boolean(name))
          ).size < assignments.length;

          return (
            <div key={document.id} className="overflow-hidden rounded-xl border border-border bg-background">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{document.name}</p>
                </div>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {signedCount}/{assignments.length} signed
                </span>
              </div>

              {assignments.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No signers assigned.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {assignments.map((assignment) => {
                    const recipient = recipientById.get(assignment.recipient_id);
                    if (!recipient) return null;

                    const meta = STATUS_META[assignment.status];
                    const StatusIcon = meta.Icon;
                    const isSigned = assignment.status === "SIGNED";
                    const canRemind =
                      showRemindActions &&
                      onRemind != null &&
                      !isSigned &&
                      assignment.status !== "DECLINED";

                    return (
                      <li
                        key={assignment.id}
                        className="flex items-start gap-3 px-4 py-3 sm:items-center"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center sm:mt-0">
                          {isSigned ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                              <CheckIcon className="h-4 w-4 text-primary-foreground" />
                            </div>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-background">
                              <StatusIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {recipientLabel(recipient, duplicateNames)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                          <Badge className={cn("font-normal", meta.badgeClass)}>{meta.label}</Badge>
                          {canRemind ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={remindDisabled}
                              onClick={() => onRemind(recipient.id)}
                            >
                              Remind
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
