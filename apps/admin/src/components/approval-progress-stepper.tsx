import * as React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

export interface ApprovalStep {
  id: string;
  label: string;
  description?: string;
  status: "completed" | "current" | "pending" | "skipped";
}

interface ApprovalProgressStepperProps {
  steps: ApprovalStep[];
  className?: string;
}

export function ApprovalProgressStepper({ steps, className }: ApprovalProgressStepperProps) {
  return (
    <nav aria-label="Progress" className={className}>
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
            <div className="relative flex items-start gap-4">
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
                {step.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Helper function to generate steps for Personal onboarding
export function getPersonalOnboardingSteps(status: string): ApprovalStep[] {
  const steps: ApprovalStep[] = [
    {
      id: "review",
      label: "Review Application",
      description: "View user details and submitted information",
      status: "completed",
    },
    {
      id: "onboarding",
      label: "Onboarding Approval",
      description: "Approve identity verification in RegTank",
      status: "pending",
    },
    {
      id: "aml",
      label: "AML Approval",
      description: "Complete AML screening in RegTank",
      status: "pending",
    },
    {
      id: "final",
      label: "Final Approval",
      description: "Complete onboarding and activate account",
      status: "pending",
    },
  ];

  switch (status) {
    case "PENDING_ONBOARDING":
      steps[1].status = "current";
      break;
    case "PENDING_APPROVAL":
      steps[1].status = "current";
      break;
    case "PENDING_AML":
      steps[1].status = "completed";
      steps[2].status = "current";
      break;
    case "PENDING_FINAL_APPROVAL":
      steps[1].status = "completed";
      steps[2].status = "completed";
      steps[3].status = "current";
      break;
    case "COMPLETED":
      steps[1].status = "completed";
      steps[2].status = "completed";
      steps[3].status = "completed";
      break;
    case "REJECTED":
    case "EXPIRED":
      // Keep current step as the one that was rejected/expired
      break;
  }

  return steps;
}

// Helper function to generate steps for Company onboarding
export function getCompanyOnboardingSteps(status: string): ApprovalStep[] {
  const steps: ApprovalStep[] = [
    {
      id: "review",
      label: "Review Application",
      description: "View company details and submitted documents",
      status: "completed",
    },
    {
      id: "onboarding",
      label: "Onboarding Approval",
      description: "Approve identity verification in RegTank",
      status: "pending",
    },
    {
      id: "aml",
      label: "AML Approval",
      description: "Complete AML screening in RegTank",
      status: "pending",
    },
    {
      id: "ssm",
      label: "SSM Verification",
      description: "Verify company against SSM records",
      status: "pending",
    },
    {
      id: "final",
      label: "Final Approval",
      description: "Complete onboarding and activate account",
      status: "pending",
    },
  ];

  switch (status) {
    case "PENDING_ONBOARDING":
      steps[1].status = "current";
      break;
    case "PENDING_APPROVAL":
      steps[1].status = "current";
      break;
    case "PENDING_AML":
      steps[1].status = "completed";
      steps[2].status = "current";
      break;
    case "PENDING_SSM_REVIEW":
      steps[1].status = "completed";
      steps[2].status = "completed";
      steps[3].status = "current";
      break;
    case "PENDING_FINAL_APPROVAL":
      steps[1].status = "completed";
      steps[2].status = "completed";
      steps[3].status = "completed";
      steps[4].status = "current";
      break;
    case "COMPLETED":
      steps[1].status = "completed";
      steps[2].status = "completed";
      steps[3].status = "completed";
      steps[4].status = "completed";
      break;
    case "REJECTED":
    case "EXPIRED":
      // Keep current step as the one that was rejected/expired
      break;
  }

  return steps;
}
