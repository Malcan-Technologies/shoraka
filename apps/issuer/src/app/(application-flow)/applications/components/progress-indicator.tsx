"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Stepper red indicator for amendment-flagged steps
 */

import * as React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { cn } from "@cashsouk/ui";

/**
 * SECTION: Loading skeleton without product workflow
 * WHY: Product unavailable / missing workflow yields empty steps; map would render nothing.
 * INPUT: isLoading true, steps [].
 * OUTPUT: Same skeleton UI with a fixed number of placeholders.
 * WHERE USED: edit flow when catalog has no product; products still loading edge cases.
 */
const DEFAULT_LOADING_PLACEHOLDER_STEPS = 6;

interface ProgressIndicatorProps {
  steps: string[];
  currentStep: number;
  /** @deprecated Used only for navigation gating; must NOT affect progress indicator rendering. */
  lastCompletedStep?: number;
  isLoading?: boolean;
  disabledSteps?: number[]; // Steps that are visible but locked (non-clickable)
  onStepClick?: (step: number) => void; // Optional click handler
  isAmendmentMode?: boolean;
  amendmentFlaggedStepKeys?: string[];
  acknowledgedWorkflowIds?: string[]; // Step keys the user has saved (from amendment_acknowledged_workflow_ids)
  stepKeys?: string[]; // Step key per index (from getStepKeyFromStepId)
  /** Normal draft flow: steps above this index (1-based) are not clickable (no checkmark override). */
  maxClickableStep?: number;
}

export function ProgressIndicator({
  steps,
  currentStep,
  isLoading = false,
  disabledSteps = [],
  onStepClick,
  isAmendmentMode = false,
  amendmentFlaggedStepKeys = [],
  acknowledgedWorkflowIds = [],
  stepKeys = [],
  maxClickableStep,
}: ProgressIndicatorProps) {
  if (isLoading) {
    const skeletonCount =
      steps.length > 0 ? steps.length : DEFAULT_LOADING_PLACEHOLDER_STEPS;
    return (
      <div className="mt-3">
        <div className="relative flex items-start justify-between min-h-[80px]">
          {Array.from({ length: skeletonCount }, (_, index) => (
            <div
              key={index}
              className="relative flex flex-1 flex-col items-center min-w-0"
              style={{ zIndex: skeletonCount - index }}
            >
              {/* Connector skeleton — behind circles */}
              {index !== 0 && (
                <div
                  className="absolute left-[-50%] w-full z-0 rounded-full bg-input"
                  style={{
                    top: "16px",
                    height: "4px",
                  }}
                />
              )}

              {/* Circle anchor — above connector line */}
              <div className="relative z-10 flex items-center justify-center h-[36px] w-[36px]">
                <div className="absolute inset-0 rounded-full bg-background opacity-0 z-10" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent z-20" />

                <div className="relative z-30 flex items-center justify-center rounded-full h-[28px] w-[28px] bg-muted animate-pulse">
                  <div className="h-[8px] w-[8px] rounded-full opacity-0" />
                </div>
              </div>

              {/* Label skeleton — nudged down */}
              <div className="mt-[13px] h-[12px] w-[72px] rounded bg-muted animate-pulse" />
              {/* <div className="mt-[11px] h-[12px] w-[72px] rounded bg-muted animate-pulse" /> */}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderStepLabel(label: string) {
    switch (label.toLowerCase()) {
      case "invoice details":
        return (
          <>
            <span>Invoice</span>
            <span>Details</span>
          </>
        );


      default:
        return label;
    }
  }



  return (
    <div className="mt-3">
      <div className="relative flex items-start justify-between min-h-[80px]">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const stepKey = stepKeys[index] ?? "";
          const isFlagged =
            isAmendmentMode &&
            amendmentFlaggedStepKeys.includes(stepKey);
          const isAcknowledged = acknowledgedWorkflowIds.includes(stepKey);
          /** Plan: amendment flagged → acknowledgement; amendment NOT flagged → always checked; normal flow → stepIndex < currentStep. Never use lastCompletedStep for UI. */
          const isCompleted =
            isAmendmentMode && stepKey === "declarations"
              ? false
              : isAmendmentMode && isFlagged
                ? isAcknowledged
                : isAmendmentMode && !isFlagged
                  ? true
                  : stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isFilled = isCompleted || isActive;
          const isDisabled = disabledSteps.includes(stepNumber);
          const isLockedFuture =
            maxClickableStep != null && stepNumber > maxClickableStep && !isAmendmentMode;
          const isNotClickable = isDisabled || isLockedFuture;

          const showFlaggedStyle = isFlagged && !(isCompleted || isDisabled);

          /** Connector red when leading to any flagged step (amended or not). */
          const connectorIsRed =
            index !== 0 &&
            isAmendmentMode &&
            isFlagged;

          // Legacy disabledSteps: show as completed (locked). Future-locked steps stay unfilled.
          const displayCompleted = isCompleted || (isDisabled && !isLockedFuture);
          const displayFilled = isFilled || (isDisabled && !isLockedFuture);

          /** Flagged + acknowledged = red circle with white check (saved amendment step). */
          const showAcknowledgedFlaggedStyle = isFlagged && isAcknowledged && displayCompleted;

          /** Beyond allowed max in normal draft: not filled, not active — gray “locked” look. */
          const isLockedUnvisited =
            !displayFilled && !isActive && isLockedFuture;

          /** Steps ahead of current that the wizard allows jumping to (edit flow). When `maxClickableStep`
           * is unset (e.g. /applications/new), future steps must stay unfilled — do not treat all future
           * steps as "clickable future" or the stepper looks fully completed. */
          const isClickableFuture =
            maxClickableStep != null &&
            stepNumber <= maxClickableStep &&
            !displayFilled &&
            !isActive &&
            !isLockedFuture &&
            stepNumber > currentStep;

          const handleClick = () => {
            if (!isNotClickable && onStepClick) {
              onStepClick(stepNumber);
            }
          };

          return (
            <div
              key={label}
              className={`relative flex flex-1 flex-col items-center min-w-0 ${isNotClickable ? "cursor-not-allowed" : onStepClick ? "cursor-pointer" : ""}`}
              style={{ zIndex: steps.length - index }}
              onClick={handleClick}
            >
              {/* Connector — behind circles; red when leading into current flagged step */}
              {index !== 0 && (
                <div
                  className={cn(
                    "absolute left-[-50%] w-full z-0 rounded-full",
                    connectorIsRed
                      ? "bg-destructive"
                      : displayFilled || isClickableFuture
                        ? "bg-foreground"
                        : "bg-input"
                  )}
                  style={{
                    top: "16px",
                    height: "4px",
                  }}
                />
              )}

              {/* Circle anchor — above connector line */}
              <div className="relative z-10 flex items-center justify-center h-[36px] w-[36px]">
                {isActive && !isNotClickable && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-background z-10" />
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full border-2 z-20",
                        isFlagged ? "border-destructive" : "border-foreground"
                      )}
                    />
                  </>
                )}

                {/* Step circle */}
                <div
                  className={cn(
                    "relative z-30 flex items-center justify-center rounded-full h-[28px] w-[28px]",
                    displayFilled
                      ? showAcknowledgedFlaggedStyle
                        ? "border-2 border-destructive bg-destructive scale-100"
                        : showFlaggedStyle
                        ? "border-2 border-destructive bg-destructive scale-100"
                        : "border-2 border-foreground bg-foreground scale-100"
                      : showFlaggedStyle
                      ? "border-2 border-destructive bg-background scale-95"
                        : isLockedUnvisited
                          ? "border-2 border-input bg-background scale-95"
                          : isClickableFuture
                            ? "border-2 border-foreground bg-foreground scale-100"
                            : "border-2 border-input bg-background scale-95"
                  )}
                >

                  {displayCompleted ? (
                    <CheckIcon
                      className={cn(
                        "relative h-[20px] w-[20px] translate-y-[0.5px]",
                        showAcknowledgedFlaggedStyle ? "text-destructive-foreground" : "text-background"
                      )}
                    />
                  ) : showFlaggedStyle ? (
                    <ExclamationTriangleIcon
                      className={cn(
                        "relative h-[14px] w-[14px]",
                        displayFilled ? "text-destructive-foreground" : "text-destructive"
                      )}
                    />
                  ) : (
                    <div
                      className={cn(
                        "relative h-[8px] w-[8px] rounded-full",
                        displayFilled || isClickableFuture
                          ? "bg-background"
                          : "bg-input"
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Label — red when flagged (before or after save); thicker when current */}
              <span
                className={cn(
                  "mt-2.5 text-center text-[12px] leading-snug max-w-[90px]",
                  isActive && isFlagged && !isNotClickable && "font-semibold text-destructive",
                  isActive && isFlagged && isNotClickable && "font-medium text-muted-foreground",
                  isActive && !isFlagged && !isNotClickable && "font-medium text-foreground",
                  isActive && !isFlagged && isNotClickable && "font-medium text-muted-foreground",
                  !isActive && (showFlaggedStyle || showAcknowledgedFlaggedStyle) && "text-destructive",
                  !isActive &&
                    displayCompleted &&
                    !showFlaggedStyle &&
                    !showAcknowledgedFlaggedStyle &&
                    "text-foreground",
                  !isActive &&
                    isNotClickable &&
                    !showFlaggedStyle &&
                    !showAcknowledgedFlaggedStyle &&
                    "text-muted-foreground",
                  !isActive &&
                    !displayCompleted &&
                    !isNotClickable &&
                    !showFlaggedStyle &&
                    !showAcknowledgedFlaggedStyle &&
                    isClickableFuture &&
                    "text-foreground",
                  !isActive &&
                    !displayCompleted &&
                    !isNotClickable &&
                    !showFlaggedStyle &&
                    !showAcknowledgedFlaggedStyle &&
                    !isClickableFuture &&
                    "text-muted-foreground"
                )}
              >
                {typeof renderStepLabel(label) === "string" ? (
                  renderStepLabel(label)
                ) : (
                  <span className="flex flex-col items-center gap-[1px]">
                    {renderStepLabel(label)}
                  </span>
                )}
              </span>

            </div>
          );
        })}
      </div>
    </div>
  );
}
