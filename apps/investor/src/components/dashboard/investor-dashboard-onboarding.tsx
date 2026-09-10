"use client";

import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { DepositCard } from "@/components/deposit-card";
import { cn } from "@/lib/utils";
import {
  currentOnboardingStepHint,
  currentOnboardingStepHref,
  onboardingStepProgress,
} from "@/investments/dashboard-state";
import type { OnboardingStep } from "@/components/onboarding-status-card";

export function InvestorDashboardOnboarding({
  steps,
  organizationId,
  tenorLabel,
}: {
  steps: OnboardingStep[];
  organizationId: string;
  tenorLabel: string;
}) {
  const progress = onboardingStepProgress(steps);
  const current = steps.find((step) => step.isCurrent);
  const remaining = steps.filter((step) => !step.isCompleted).length;
  const currentHref = current ? currentOnboardingStepHref(current.id) : null;
  const showDeposit = current?.id === "deposit";

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 md:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 className="text-section-title text-primary">Set up your investor account</h2>
              <p className="mt-1 text-ui text-muted-foreground">
                {progress.completed} of {progress.total}{" "}
                {progress.total === 1 ? "step" : "steps"} done
                {current ? `. You are on ${current.label.toLowerCase()}.` : "."}
              </p>
            </div>
            <p className="text-ui font-semibold tabular-nums text-primary">
              {progress.percent}% complete
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <ol className="mt-6 flex flex-col">
            {steps.map((step, index) => {
              const hint = step.isCurrent ? currentOnboardingStepHint(step.id) : null;
              const href = step.isCurrent ? currentHref : null;
              const continueIsHash = href?.startsWith("#");

              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3.5 border-b border-border py-3.5 last:border-b-0",
                    step.isCurrent &&
                      "-mx-4 my-1.5 rounded-xl border border-status-action-text/40 bg-status-action-bg px-4 py-4 last:border-b"
                  )}
                >
                  {step.isCompleted ? (
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-status-success-text" />
                  ) : (
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-meta font-semibold",
                        step.isCurrent
                          ? "border-status-action-text text-status-action-text"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-ui font-medium",
                        step.isCurrent
                          ? "text-status-action-text"
                          : step.isCompleted
                            ? "text-foreground"
                            : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </p>
                    {hint ? (
                      <p
                        className={cn(
                          "text-meta",
                          step.isCurrent ? "text-status-action-text/80" : "text-muted-foreground"
                        )}
                      >
                        {hint}
                      </p>
                    ) : null}
                  </div>
                  {step.isCompleted ? (
                    <StatusBadge label="Done" status="success" size="sm" />
                  ) : step.isCurrent && href ? (
                    <Button asChild className="h-10 shrink-0 rounded-xl font-semibold">
                      {continueIsHash ? (
                        <a href={href}>Continue</a>
                      ) : (
                        <Link href={href}>Continue</Link>
                      )}
                    </Button>
                  ) : (
                    <StatusBadge label="Not started" status="neutral" size="sm" />
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {showDeposit ? (
        <div id="first-deposit">
          <DepositCard organizationId={organizationId} />
        </div>
      ) : null}

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 md:p-7">
          <h3 className="text-card-title text-primary">What you will get access to</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                title: "Marketplace",
                body: `Verified invoice financing notes with ${tenorLabel} tenors.`,
              },
              {
                title: "Portfolio tracking",
                body: "Value over time, returns earned, and every repayment.",
              },
              {
                title: "Cashflow forecast",
                body: "See what is coming back to your wallet and when.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-dashed border-border bg-muted/30 p-4"
              >
                <p className="text-ui font-medium text-muted-foreground">{item.title}</p>
                <p className="mt-1.5 text-ui leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
          {remaining > 0 ? (
            <p className="sr-only">{remaining} onboarding steps remaining</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
