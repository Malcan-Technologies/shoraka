"use client";

import * as React from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import type { OnboardingStepperStep } from "@cashsouk/config";
import { cn } from "../lib/utils";

export type { OnboardingStepperStep };

interface OnboardingStepperProps {
  steps: OnboardingStepperStep[];
  className?: string;
  onStepClick?: (stepId: string) => void;
}

function stepCircleClass(step: OnboardingStepperStep): string {
  if (step.isRejected) return "bg-destructive border-destructive text-destructive-foreground";
  if (step.isCompleted) return "bg-primary border-primary text-primary-foreground";
  if (step.isCurrent) return "bg-background border-primary border-[3px] ring-4 ring-primary/20";
  return "bg-muted border-muted-foreground/30 text-muted-foreground";
}

function stepLabelClass(step: OnboardingStepperStep): string {
  if (step.isRejected) return "text-destructive";
  if (step.isCurrent) return "text-primary";
  if (step.isCompleted) return "text-foreground";
  return "text-muted-foreground";
}

function StepGlyph({ step }: { step: OnboardingStepperStep }) {
  if (step.isRejected) return <XMarkIcon className="w-5 h-5" />;
  if (step.isCompleted) return <CheckIcon className="w-5 h-5" />;
  if (step.isCurrent) return <div className="w-3 h-3 rounded-full bg-primary" />;
  return <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />;
}

function StepMarker({
  step,
  interactive,
  onSelect,
}: {
  step: OnboardingStepperStep;
  interactive: boolean;
  onSelect?: (stepId: string) => void;
}) {
  const body = (
    <>
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
          stepCircleClass(step)
        )}
      >
        <StepGlyph step={step} />
      </div>
      <span
        className={cn(
          "mt-2 text-xs md:text-sm font-medium text-center w-[80px] md:w-[100px] min-h-[2.5rem]",
          stepLabelClass(step)
        )}
      >
        {step.label}
      </span>
    </>
  );

  const sharedClass =
    "flex flex-col items-center relative z-10 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  if (step.href) {
    return (
      <a
        href={step.href}
        className={sharedClass}
        aria-current={step.isCurrent ? "step" : undefined}
        aria-label={step.label}
      >
        {body}
      </a>
    );
  }

  if (interactive && onSelect) {
    return (
      <button
        type="button"
        className={sharedClass}
        aria-current={step.isCurrent ? "step" : undefined}
        aria-label={step.label}
        onClick={() => onSelect(step.id)}
      >
        {body}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center relative z-10" aria-current={step.isCurrent ? "step" : undefined}>
      {body}
    </div>
  );
}

export function OnboardingStepper({ steps, className, onStepClick }: OnboardingStepperProps) {
  const interactive = Boolean(onStepClick) || steps.some((step) => Boolean(step.href));

  return (
    <nav className={className} aria-label="Progress">
      <ol className="relative flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <li className="flex flex-col items-center">
              <StepMarker step={step} interactive={interactive} onSelect={onStepClick} />
            </li>
            {index < steps.length - 1 ? (
              <li aria-hidden className="flex-1 h-0.5 mx-2 -mt-6 list-none">
                <div
                  className={cn(
                    "h-full transition-all",
                    step.isRejected
                      ? "bg-destructive/30"
                      : step.isCompleted
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                  )}
                />
              </li>
            ) : null}
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}
