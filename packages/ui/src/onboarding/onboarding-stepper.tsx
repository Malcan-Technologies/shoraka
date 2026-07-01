"use client";

import * as React from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import type { OnboardingStepperStep } from "@cashsouk/config";

export type { OnboardingStepperStep };

interface OnboardingStepperProps {
  steps: OnboardingStepperStep[];
  className?: string;
}

export function OnboardingStepper({ steps, className }: OnboardingStepperProps) {
  return (
    <div className={className}>
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                    ${
                      step.isRejected
                        ? "bg-destructive border-destructive text-destructive-foreground"
                        : step.isCompleted
                          ? "bg-primary border-primary text-primary-foreground"
                          : step.isCurrent
                            ? "bg-background border-primary border-[3px] ring-4 ring-primary/20"
                            : "bg-muted border-muted-foreground/30 text-muted-foreground"
                    }
                  `}
                >
                  {step.isRejected ? (
                    <XMarkIcon className="w-5 h-5" />
                  ) : step.isCompleted ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : step.isCurrent ? (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs md:text-sm font-medium text-center w-[80px] md:w-[100px] min-h-[2.5rem]
                    ${step.isRejected ? "text-destructive" : step.isCurrent ? "text-primary" : step.isCompleted ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 -mt-6">
                  <div
                    className={`h-full transition-all ${
                      step.isRejected
                        ? "bg-destructive/30"
                        : step.isCompleted
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
