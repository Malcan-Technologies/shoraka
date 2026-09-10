import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { pipelineStepLabel, type PipelineStepState } from "./where-things-stand";

export function DashboardPipelineStep({
  label,
  state,
  yourTurn,
}: {
  label: string;
  state: PipelineStepState;
  yourTurn: boolean;
}) {
  const currentToken = yourTurn ? "action" : "submitted";
  const displayLabel = pipelineStepLabel(label, state, yourTurn);
  return (
    <div
      className={cn(
        "flex min-w-[7.5rem] flex-1 items-center gap-2 border-t-2 pt-2.5",
        state === "done" && "border-status-success-text",
        state === "current" && yourTurn && "border-status-action-text",
        state === "current" && !yourTurn && "border-status-submitted-text",
        state === "failed" && "border-status-rejected-text",
        state === "upcoming" && "border-border"
      )}
    >
      {state === "done" ? (
        <CheckCircleIcon className="h-[18px] w-[18px] shrink-0 text-status-success-text" aria-hidden />
      ) : state === "failed" ? (
        <XCircleIcon className="h-[18px] w-[18px] shrink-0 text-status-rejected-text" aria-hidden />
      ) : state === "current" ? (
        <span
          className={cn(
            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full",
            yourTurn ? "bg-status-action-text" : "bg-status-submitted-text"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-card" />
        </span>
      ) : (
        <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-border" />
      )}
      <span
        className={cn(
          "text-ui",
          state === "current" && currentToken === "action" && "font-medium text-status-action-text",
          state === "current" && currentToken === "submitted" && "font-medium text-status-submitted-text",
          state === "failed" && "font-medium text-status-rejected-text",
          state === "upcoming" && "text-muted-foreground"
        )}
      >
        {displayLabel}
      </span>
    </div>
  );
}
