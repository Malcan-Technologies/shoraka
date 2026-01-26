"use client";

import * as React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";

interface ProgressIndicatorProps {
  steps: string[];
  currentStep: number;
  isLoading?: boolean;
}

export function ProgressIndicator({
  steps,
  currentStep,
  isLoading = false,
}: ProgressIndicatorProps) {
  if (isLoading) {
    return (
      <div className="relative flex items-start justify-between w-full overflow-x-auto min-h-[60px] md:min-h-[72px]">
        <div className="flex items-start justify-between w-full min-w-max md:min-w-0">
          {steps.map((_, index) => (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center z-10 flex-1 min-w-[60px] md:min-w-0">
                <div className="relative size-6 md:size-8 flex items-center justify-center">
                  <div className="size-5 md:size-6 rounded-full bg-muted animate-pulse" />
                </div>
                <div className="text-xs md:text-sm mt-1.5 md:mt-2 text-center px-1">
                  <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto" />
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className="hidden md:block absolute top-3 md:top-4 z-0 bg-border"
                  style={{
                    left: `calc(${(index + 0.5) * (100 / steps.length)}% + 12px)`,
                    width: `calc(${100 / steps.length}% - 24px)`,
                    height: '1.5px',
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-start justify-between w-full overflow-x-auto min-h-[60px] md:min-h-[72px]">
      <div className="flex items-start justify-between w-full min-w-max md:min-w-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const nextIsCompleted = stepNumber + 1 < currentStep;

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center z-10 flex-1 min-w-[60px] md:min-w-0">
                <div className="relative size-6 md:size-8 flex items-center justify-center">
                  {isCompleted ? (
                    <div className="size-5 md:size-6 flex items-center justify-center rounded-full bg-foreground text-background">
                      <CheckIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    </div>
                  ) : isCurrent ? (
                    <div className="size-6 md:size-8 rounded-full border-2 border-foreground flex items-center justify-center bg-background">
                      <div className="size-5 md:size-6 flex items-center justify-center rounded-full bg-foreground">
                        <div className="size-1 md:size-1.5 rounded-full bg-background" />
                      </div>
                    </div>
                  ) : (
                    <div className="size-5 md:size-6 flex items-center justify-center rounded-full bg-background border-2 border-muted-foreground/30">
                      <div className="size-1 md:size-1.5 rounded-full bg-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div
                  className={`text-xs md:text-sm mt-1.5 md:mt-2 text-center px-1 ${
                    isCurrent
                      ? "text-foreground font-semibold"
                      : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground/70"
                  }`}
                >
                  {step}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`hidden md:block absolute top-3 md:top-4 z-0 ${
                    stepNumber < currentStep ? "bg-foreground" : "bg-muted-foreground/30"
                  }`}
                  style={{
                    left: `calc(${(index + 0.5) * (100 / steps.length)}% + 12px)`,
                    width: `calc(${100 / steps.length}% - 24px)`,
                    height: '1.5px',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
