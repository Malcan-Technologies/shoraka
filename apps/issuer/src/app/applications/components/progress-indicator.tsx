"use client";

import * as React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";

interface ProgressIndicatorProps {
  steps: string[];
  currentStep: number;
  isLoading?: boolean;
  disabledSteps?: number[]; // Steps that are visible but locked (non-clickable)
  onStepClick?: (step: number) => void; // Optional click handler
}

export function ProgressIndicator({
  steps,
  currentStep,
  isLoading = false,
  disabledSteps = [],
  onStepClick,
}: ProgressIndicatorProps) {
  if (isLoading) {
    return (
      <div className="mt-3">
        <div className="relative flex items-start justify-between">
          {steps.map((_, index) => (
            <div
              key={index}
              className="relative flex flex-1 flex-col items-center min-w-0"
            >
              {/* Connector skeleton */}
              {index !== 0 && (
                <div
                  className="absolute left-[-50%] w-full z-0 rounded-full bg-muted"
                  style={{
                    top: "16.5px",
                    height: "3px",
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
    console.log(label)
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
      <div className="relative flex items-start justify-between">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isFilled = isCompleted || isActive;
          const isDisabled = disabledSteps.includes(stepNumber);

          // For disabled steps, always show as completed (locked)
          const displayCompleted = isCompleted || isDisabled;
          const displayFilled = isFilled || isDisabled;

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
              {/* Connector — slightly thinner */}
              {index !== 0 && (
                <div
                  className={`absolute left-[-50%] w-full z-0 rounded-full ${displayFilled ? "bg-foreground" : "bg-border"}`}
                  style={{
                    top: "16.5px",
                    height: "3px",
                  }}
                />
              )}

              {/* Circle anchor */}
              <div className="relative flex items-center justify-center h-[36px] w-[36px]">
                {isActive && !isDisabled && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-background z-10" />
                    <div className="absolute inset-0 rounded-full border-2 border-foreground z-20" />
                  </>
                )}

                {/* Step circle */}
                <div
                  className={`relative z-30 flex items-center justify-center rounded-full h-[28px] w-[28px]
                     ${displayFilled ? "border-2 border-foreground bg-foreground" : "border-2 border-border bg-background"} `}
                >
                  {displayCompleted ? (
                    <CheckIcon
                      className="h-[20px] w-[20px] text-background translate-y-[0.5px]"
                    />

                  ) : (
                    <div className={`h-[8px] w-[8px] rounded-full ${displayFilled ? "bg-background" : "bg-border"}`} />
                  )}
                </div>
              </div>

              {/* Label */}
              <span
                className={`mt-2.5 text-center text-[12px] leading-snug max-w-[90px]
                  ${isActive && !isDisabled
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                  }`}
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
