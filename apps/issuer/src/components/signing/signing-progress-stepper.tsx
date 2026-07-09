import { CheckIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

export interface SigningOfferStep {
  id: string;
  label: string;
  description?: string;
  status: "completed" | "current" | "pending" | "skipped";
}

interface SigningProgressStepperProps {
  steps: SigningOfferStep[];
  className?: string;
}

export function SigningProgressStepper({ steps, className }: SigningProgressStepperProps) {
  return (
    <nav aria-label="Signing progress" className={className}>
      <ol className="space-y-4">
        {steps.map((step, stepIdx) => (
          <li key={step.id} className="relative">
            {stepIdx !== steps.length - 1 && (
              <div
                className={cn(
                  "absolute left-[15px] top-[32px] h-[calc(100%-8px)] w-0.5",
                  step.status === "completed" ? "bg-primary" : "bg-border"
                )}
                aria-hidden="true"
              />
            )}
            <div
              className="relative flex items-start gap-4"
              aria-current={step.status === "current" ? "step" : undefined}
            >
              <div className="flex-shrink-0">
                {step.status === "completed" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                    <CheckIcon className="h-4 w-4 text-primary-foreground" />
                  </div>
                ) : step.status === "current" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  </div>
                ) : step.status === "skipped" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <span className="text-xs font-medium text-muted-foreground">—</span>
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-background">
                    <span className="text-xs font-medium text-muted-foreground">{stepIdx + 1}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.status === "current"
                      ? "text-primary"
                      : step.status === "completed"
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.description ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
