"use client";

import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import type { OnboardingStep } from "../onboarding-status-card";
import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { onboardingStepCta } from "./resolve-issuer-dashboard-state";

const STEP_HELP: Record<string, string> = {
  tnc: "Accept the issuer agreement to continue.",
  fee: "One-off fee covering SSM and credit checks.",
  verify: "SSM documents, directors and shareholders, bank details.",
  approval: "We review your business before you can apply.",
};

const UNLOCKS = [
  {
    title: "Financing applications",
    body: "Raise cash against invoices you have already issued.",
  },
  {
    title: "Facility limit",
    body: "A revolving limit you can draw against, invoice by invoice.",
  },
  {
    title: "Repayment tracking",
    body: "Every note, every due date, and the full cost of financing.",
  },
];

export function IssuerDashboardOnboarding({
  steps,
  orgName,
}: {
  steps: OnboardingStep[];
  orgName: string;
}) {
  const completedCount = steps.filter((step) => step.isCompleted).length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const remaining = steps.filter((step) => !step.isCompleted && !step.isRejected).length;

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 md:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 className="text-section-title text-primary">Finish setting up your business account</h2>
              <p className="mt-1 text-ui text-muted-foreground">
                {remaining === 0
                  ? "All onboarding steps are complete."
                  : remaining === 1
                    ? "One step left."
                    : `${completedCount} of ${total} steps done.`}
              </p>
            </div>
            <span className="text-ui font-semibold tabular-nums text-primary">{percent}% complete</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>

          <div className="mt-6 flex flex-col">
            {steps.map((step, index) => {
              const cta = step.isCurrent ? onboardingStepCta(step.id) : null;
              const help = STEP_HELP[step.id] ?? step.label;
              const detail =
                step.id === "tnc" && orgName
                  ? `${orgName}`
                  : help;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 py-3.5",
                    index < steps.length - 1 && !step.isCurrent && "border-b border-border",
                    step.isCurrent &&
                      "my-1 rounded-xl border border-status-action-text/40 bg-status-action-bg px-4 py-4"
                  )}
                >
                  {step.isCompleted ? (
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-status-success-text" aria-hidden />
                  ) : step.isCurrent ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-status-action-text text-meta font-semibold text-status-action-text">
                      {index + 1}
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border text-meta font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-ui font-medium",
                        step.isCurrent && "text-status-action-text",
                        !step.isCompleted && !step.isCurrent && "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </p>
                    <p
                      className={cn(
                        "text-meta",
                        step.isCurrent ? "text-status-action-text/80" : "text-muted-foreground"
                      )}
                    >
                      {detail}
                    </p>
                  </div>
                  {step.isCompleted ? (
                    <StatusBadge label="Done" status="success" size="sm" />
                  ) : cta ? (
                    <Button asChild className="h-10 shrink-0 rounded-xl font-semibold">
                      <Link href={cta.href}>{cta.label}</Link>
                    </Button>
                  ) : (
                    <StatusBadge label="Not started" status="neutral" size="sm" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 md:p-7">
          <h3 className="text-card-title">What unlocks when you finish</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {UNLOCKS.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-dashed border-border bg-muted/30 p-4"
              >
                <p className="text-ui font-medium text-muted-foreground">{item.title}</p>
                <p className="mt-1.5 text-ui leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
