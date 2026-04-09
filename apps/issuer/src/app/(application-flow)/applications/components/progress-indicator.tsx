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
}

export function ProgressIndicator({
  steps,
  currentStep,
  lastCompletedStep: _lastCompletedStep,
  isLoading = false,
  disabledSteps = [],
  onStepClick,
  isAmendmentMode = false,
  amendmentFlaggedStepKeys = [],
  acknowledgedWorkflowIds = [],
  stepKeys = [],
}: ProgressIndicatorProps) {
  if (isLoading) {
    const skeletonCount =
      steps.length > 0 ? steps.length : DEFAULT_LOADING_PLACEHOLDER_STEPS;
    if (steps.length === 0) {
      console.log(
        "ProgressIndicator: loading skeleton with placeholder step count:",
        skeletonCount
      );
    }
    return (
      <div className="mt-3">
        <div className="relative flex items-start justify-between min-h-[80px]">
          {Array.from({ length: skeletonCount }, (_, index) => (
            <div
              key={index}
              className="relative flex flex-1 flex-col items-center min-w-0"
            >
              {/* Connector skeleton */}
              {index !== 0 && (
                <div
                  className="absolute left-[-50%] w-full z-0 rounded-full bg-muted"
                  style={{
                    top: "16px",
                    height: "4px",
                  }}
                />
              )}

              {/* Circle anchor */}
              <div className="relative flex items-center justify-center h-[36px] w-[36px]">
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
            isAmendmentMode && stepKey === "review_and_submit"
              ? false
              : isAmendmentMode && isFlagged
                ? isAcknowledged
                : isAmendmentMode && !isFlagged
                  ? true
                  : stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isFilled = isCompleted || isActive;
          const isDisabled = disabledSteps.includes(stepNumber);


          const showFlaggedStyle = isFlagged && !(isCompleted || isDisabled);

          /** Connector red when leading to any flagged step (amended or not). */
          const connectorIsRed =
            index !== 0 &&
            isAmendmentMode &&
            isFlagged;

          // For disabled steps, always show as completed (locked)
          const displayCompleted = isCompleted || isDisabled;
          const displayFilled = isFilled || isDisabled;

          /** Flagged + acknowledged = red circle with white check (saved amendment step). */
          const showAcknowledgedFlaggedStyle = isFlagged && isAcknowledged && displayCompleted;

          const handleClick = () => {
            if (!isDisabled && onStepClick) {
              onStepClick(stepNumber);
            }
          };

          return (
            <div
              key={label}
              className={`relative flex flex-1 flex-col items-center min-w-0 ${isDisabled ? "cursor-not-allowed opacity-50" : onStepClick ? "cursor-pointer" : ""}`}
              onClick={handleClick}
            >
              {/* Connector — red when leading into current flagged step */}
              {index !== 0 && (
                <div
                  className={cn(
                    "absolute left-[-50%] w-full z-0 rounded-full transition-colors duration-300 ease-out",
                    connectorIsRed ? "bg-destructive" : displayFilled ? "bg-foreground" : "bg-muted"
                  )}
                  style={{
                    top: "16px",
                    height: "4px",
                  }}
                />
              )}

              {/* Circle anchor */}
              <div className="relative flex items-center justify-center h-[36px] w-[36px]">
                {isActive && !isDisabled && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-background z-10 transition-opacity duration-200 ease-out" />
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full border-2 z-20 transition-all duration-200 ease-out",
                        isFlagged ? "border-destructive" : "border-foreground"
                      )}
                    />
                  </>
                )}

                {/* Step circle */}
                <div
                  className={cn(
                    "relative z-30 flex items-center justify-center rounded-full h-[28px] w-[28px] transition-all duration-200 ease-out",
                    displayFilled
                      ? showAcknowledgedFlaggedStyle
                        ? "border-2 border-destructive bg-destructive scale-100"
                        : showFlaggedStyle
                        ? "border-2 border-destructive bg-destructive scale-100"
                        : "border-2 border-foreground bg-foreground scale-100"
                      : showFlaggedStyle
                      ? "border-2 border-destructive bg-background scale-95"
                      : "border-2 border-muted bg-background scale-95"
                  )}
                >
                  {/* Unfilled highlight disk (SOLID, no opacity) */}
                  {!displayFilled && (
                    <div className="absolute inset-[0px] rounded-full bg-muted/5" />
                  )}

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
                        displayFilled ? "bg-background" : "bg-muted-foreground/15"
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Label — red when flagged (before or after save); thicker when current */}
              <span
                className={cn(
                  "mt-2.5 text-center text-[12px] leading-snug max-w-[90px] transition-colors duration-200 ease-out",
                  isActive && isFlagged && !isDisabled
                    ? "font-semibold text-destructive"
                    : isActive && !isDisabled
                    ? "font-medium text-foreground"
                    : showFlaggedStyle || showAcknowledgedFlaggedStyle
                    ? "text-destructive"
                    : "text-muted-foreground"
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
