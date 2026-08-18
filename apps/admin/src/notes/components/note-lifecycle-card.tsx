"use client";

import { format } from "date-fns";
import { CheckIcon, MapIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { NoteDetail } from "@cashsouk/types";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import {
  NOTE_LIFECYCLE_STAGES,
  findIssuerDisbursementWithdrawal,
  getNoteLifecycleCardTone,
  getNoteLifecycleStageCompletedAt,
  getNoteLifecycleStageIndex,
  getNoteLifecycleTerminalFailure,
  getNoteListingAutoCloseInfo,
  isDisbursementComplete,
} from "@/notes/utils/note-lifecycle-actions";
import { isNoteLifecycleVisuallyComplete } from "@/notes/utils/settlement-trustee-workflow";
import { WORKFLOW_CARD } from "@/notes/utils/workflow-status-tokens";

export type { NoteLifecycleAction } from "@/notes/utils/note-lifecycle-actions";

const LIFECYCLE_STEPPER_FILL = {
  success: "bg-status-success-bg text-status-success-text ring-status-success-text/20",
  active: "bg-status-active-bg text-status-active-text ring-status-active-text/20",
  rejected: "bg-status-rejected-bg text-status-rejected-text ring-status-rejected-text/20",
  neutral: "bg-status-neutral-bg text-status-neutral-text ring-status-neutral-text/15",
} as const;

function StageDot({
  index,
  active,
  past,
  failed,
}: {
  index: number;
  active: boolean;
  past: boolean;
  failed: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-meta font-semibold ring-1",
        failed && active
          ? LIFECYCLE_STEPPER_FILL.rejected
          : past
            ? LIFECYCLE_STEPPER_FILL.success
            : active
              ? LIFECYCLE_STEPPER_FILL.active
              : LIFECYCLE_STEPPER_FILL.neutral
      )}
    >
      {failed && active ? (
        <XMarkIcon className="h-3.5 w-3.5" />
      ) : past ? (
        <CheckIcon className="h-3.5 w-3.5" />
      ) : (
        index + 1
      )}
    </div>
  );
}

interface NoteLifecycleCardProps {
  note: NoteDetail;
}

export function NoteLifecycleCard({ note }: NoteLifecycleCardProps) {
  const activeIndex = getNoteLifecycleStageIndex(note);
  const isComplete = isNoteLifecycleVisuallyComplete(note);
  const lifecycleCardTone = getNoteLifecycleCardTone(note);
  const currentStage = NOTE_LIFECYCLE_STAGES[activeIndex];
  const terminalFailure = getNoteLifecycleTerminalFailure(note, activeIndex);
  const disbursementComplete = isDisbursementComplete(findIssuerDisbursementWithdrawal(note));
  const awaitingDisbursement =
    !isComplete &&
    !terminalFailure &&
    note.fundingStatus === "FUNDED" &&
    !disbursementComplete;
  const autoClose =
    note.status === "PUBLISHED" && note.fundingStatus === "OPEN"
      ? getNoteListingAutoCloseInfo(note)
      : null;

  const headerTitle = isComplete
    ? "Note complete"
    : terminalFailure
      ? terminalFailure.label
      : awaitingDisbursement
        ? "Awaiting issuer disbursement"
        : `Currently ${currentStage?.label ?? "Draft"}`;

  return (
    <Card
      className={cn(
        "rounded-2xl",
        lifecycleCardTone === "action" && WORKFLOW_CARD.activeSection,
        lifecycleCardTone === "waiting" && WORKFLOW_CARD.warningSection
      )}
    >
      <AdminDetailCardHeader
        icon={MapIcon}
        title="Lifecycle"
        description={headerTitle}
        actions={
          isComplete ? (
            <StatusBadge label="Complete" status="success" />
          ) : terminalFailure ? (
            <StatusBadge label="Terminal" status="rejected" />
          ) : awaitingDisbursement ? (
            <StatusBadge label="Pending disbursement" status="action" />
          ) : null
        }
      />
      <CardContent className="pt-0">
        {terminalFailure ? (
          <p className="mb-4 text-ui text-muted-foreground">{terminalFailure.description}</p>
        ) : null}

        <ol className="space-y-0">
          {NOTE_LIFECYCLE_STAGES.map((stage, idx) => {
            const isFailureStage = terminalFailure?.stageIndex === idx;
            const isPast = isComplete
              ? true
              : terminalFailure
                ? idx < terminalFailure.stageIndex
                : idx < activeIndex;
            const isCurrent = !isComplete && !terminalFailure && idx === activeIndex;
            const connectorActive = isComplete
              ? true
              : terminalFailure
                ? idx < terminalFailure.stageIndex
                : idx < activeIndex;
            const completedAt =
              isPast || isComplete ? getNoteLifecycleStageCompletedAt(note, stage.id) : null;
            const isLast = idx === NOTE_LIFECYCLE_STAGES.length - 1;

            return (
              <li key={stage.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <StageDot
                    index={idx}
                    active={isCurrent || isFailureStage}
                    past={isPast && !isFailureStage}
                    failed={isFailureStage}
                  />
                  {isLast ? null : (
                    <div
                      className={cn(
                        "my-1 w-px flex-1 min-h-4",
                        connectorActive ? "bg-status-success-bg" : "bg-border"
                      )}
                    />
                  )}
                </div>
                <div className={cn("min-w-0 pb-4", isLast && "pb-0")}>
                  <p
                    className={cn(
                      "text-ui leading-7",
                      isFailureStage
                        ? "font-semibold text-status-rejected-text"
                        : isCurrent
                          ? "font-semibold text-status-active-text"
                          : isPast
                            ? "text-status-success-text"
                            : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </p>
                  {completedAt ? (
                    <p className="text-meta text-muted-foreground">
                      {format(new Date(completedAt), "dd MMM yyyy")}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {autoClose ? (
          <p className="mt-4 text-meta text-muted-foreground">{autoClose.label}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
