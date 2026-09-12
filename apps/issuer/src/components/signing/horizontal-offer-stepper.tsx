"use client";

import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import type { HorizontalOfferStep } from "@/lib/offer-stepper-model";

type HorizontalOfferStepperProps = {
  steps: HorizontalOfferStep[];
  className?: string;
  onStepClick?: (stepId: string) => void;
};

function StepGlyph({
  step,
  index,
}: {
  step: HorizontalOfferStep;
  index: number;
}) {
  if (step.status === "completed") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (step.status === "blocked") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10 text-destructive">
        <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (step.status === "current") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card text-meta font-semibold tabular-nums text-primary">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-meta font-medium tabular-nums text-muted-foreground">
      {index + 1}
    </span>
  );
}

function StepLabel({
  step,
  isClickable,
  onStepClick,
}: {
  step: HorizontalOfferStep;
  isClickable: boolean;
  onStepClick?: (stepId: string) => void;
}) {
  const labelClass = cn(
    "mt-2 min-w-0 px-1.5 text-center",
    isClickable
      ? "cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      : onStepClick && !step.clickable
        ? "cursor-not-allowed"
        : undefined
  );
  const inner = (
    <>
      <div
        className={cn(
          "text-ui text-pretty",
          step.status === "pending" ? "font-medium text-muted-foreground" : "font-semibold text-foreground"
        )}
      >
        {step.label}
      </div>
      {step.hint ? (
        <div className="mt-0.5 text-meta text-muted-foreground">{step.hint}</div>
      ) : null}
    </>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        className={labelClass}
        aria-current={step.status === "current" ? "step" : undefined}
        onClick={() => onStepClick?.(step.id)}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={labelClass} aria-current={step.status === "current" ? "step" : undefined}>
      {inner}
    </div>
  );
}

export function HorizontalOfferStepper({
  steps,
  className,
  onStepClick,
}: HorizontalOfferStepperProps) {
  return (
    <nav aria-label="Offer progress" className={cn("min-w-0 overflow-x-auto", className)}>
      <ol className="flex min-w-max items-start pb-1">
        {steps.map((step, index) => {
          const isClickable = Boolean(onStepClick) && step.clickable;
          const connectorDone =
            step.status === "completed" ||
            (index > 0 && steps[index - 1]?.status === "completed");
          return (
            <li key={step.id} className="flex min-w-28 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {index === 0 ? (
                  <span className="h-0.5 flex-1" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "h-0.5 flex-1 rounded-full",
                      connectorDone ? "bg-primary" : "bg-border"
                    )}
                    aria-hidden
                  />
                )}
                <StepGlyph step={step} index={index} />
                {index === steps.length - 1 ? (
                  <span className="h-0.5 flex-1" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "h-0.5 flex-1 rounded-full",
                      step.status === "completed" ? "bg-primary" : "bg-border"
                    )}
                    aria-hidden
                  />
                )}
              </div>
              <StepLabel step={step} isClickable={isClickable} onStepClick={onStepClick} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
