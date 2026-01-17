"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  steps: readonly string[];
  currentStep: number;
}

export function ProgressIndicator({ steps, currentStep }: ProgressIndicatorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isUpcoming = index > currentStep;

          return (
            <React.Fragment key={step}>
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                    isActive
                      ? "bg-primary border-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-background border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>
                {/* Step Label (hidden on mobile, shown on larger screens) */}
                <span
                  className={cn(
                    "mt-2 text-xs text-center hidden sm:block max-w-[80px]",
                    isActive
                      ? "font-semibold text-foreground"
                      : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                  )}
                >
                  {step}
                </span>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-colors",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
