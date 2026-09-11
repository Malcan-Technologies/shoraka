"use client";

import * as React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";
import { StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  isReferenceOfferAcceptanceStage,
  type OfferAcceptanceStage,
  type OfferAcceptanceStageTone,
} from "./offer-acceptance-stages";

function toneToStatus(tone: OfferAcceptanceStageTone): "success" | "action" | "submitted" | "neutral" {
  if (tone === "done") return "success";
  if (tone === "action") return "action";
  if (tone === "wait") return "submitted";
  return "neutral";
}

function markerState(
  tone: OfferAcceptanceStageTone,
  isCurrent: boolean
): "done" | "current" | "pending" | "locked" {
  if (isCurrent) return "current";
  if (tone === "done") return "done";
  if (tone === "locked") return "locked";
  return "pending";
}

export function OfferAcceptanceStageCard({
  stage,
  workflowNumber,
  isCurrent,
  isLastWorkflow,
  open,
  onOpenChange,
  children,
}: {
  stage: OfferAcceptanceStage;
  /** 1-based rail number; omitted for reference cards. */
  workflowNumber?: number | null;
  isCurrent: boolean;
  isLastWorkflow: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const isReference = isReferenceOfferAcceptanceStage(stage);
  const marker = markerState(stage.tone, isCurrent);
  const stageDomId = `offer-acceptance-stage-${stage.id}`;

  const header = (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn("min-w-0 flex-1", isReference || isLastWorkflow ? "pb-0" : "pb-3.5")}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            id={stageDomId}
            tabIndex={-1}
            className="flex w-full flex-wrap items-center gap-3 px-4 py-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-[1.125rem]"
            aria-expanded={open}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-foreground">{stage.title}</span>
                <StatusBadge label={stage.tag} status={toneToStatus(stage.tone)} />
              </span>
              <span className="mt-1 block text-ui text-muted-foreground">{stage.summary}</span>
            </span>
            <span className="text-ui font-semibold text-primary">
              {open ? "Collapse" : "Expand"}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-4 py-4 sm:px-[1.125rem]">
            {stage.tone === "locked" && stage.lockTooltip ? (
              <p className="mb-4 text-ui text-muted-foreground">{stage.lockTooltip}</p>
            ) : null}
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );

  if (isReference) {
    return <div className="py-3.5 first:pt-0 last:pb-0">{header}</div>;
  }

  const number = workflowNumber ?? 0;

  return (
    <div className="flex gap-3 sm:gap-3.5">
      <div className="flex w-7 shrink-0 flex-col items-center sm:w-[1.875rem]">
        {marker === "done" ? (
          <span
            className="flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-full bg-primary text-primary-foreground"
            aria-hidden
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span
            className={cn(
              "flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-full text-ui font-semibold",
              marker === "current"
                ? "border-[3px] border-primary bg-card text-primary"
                : "border-2 border-border bg-card text-muted-foreground"
            )}
            aria-hidden
          >
            {number}
          </span>
        )}
        {isLastWorkflow ? null : <span className="mt-1.5 w-0.5 flex-1 bg-border" aria-hidden />}
      </div>
      {header}
    </div>
  );
}
