"use client";

import * as React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";
import type { Organization } from "@cashsouk/config";

interface OnboardingStep {
  id: string;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface OnboardingStatusCardProps {
  organization: Organization;
  userName?: string;
}

/**
 * Determine the current onboarding step based on organization status
 * Steps for Issuer Portal (no Deposit step):
 * 1. Onboarding - Complete when onboardingApproved === true
 * 2. Accepting User Agreement - Complete when tncAccepted === true
 * 3. Account Approval - Complete when onboardingStatus === 'COMPLETED'
 */
function getOnboardingSteps(organization: Organization): OnboardingStep[] {
  const onboardingComplete = organization.onboardingApproved === true;
  const tncComplete = organization.tncAccepted === true;
  const accountApprovalComplete = organization.onboardingStatus === "COMPLETED";

  // Determine current step (first incomplete step)
  let currentStepId = "onboarding";
  if (onboardingComplete && !tncComplete) {
    currentStepId = "tnc";
  } else if (onboardingComplete && tncComplete && !accountApprovalComplete) {
    currentStepId = "approval";
  } else if (onboardingComplete && tncComplete && accountApprovalComplete) {
    currentStepId = ""; // All complete
  }

  return [
    {
      id: "onboarding",
      label: "Onboarding",
      isCompleted: onboardingComplete,
      isCurrent: currentStepId === "onboarding",
    },
    {
      id: "tnc",
      label: "Accepting User Agreement",
      isCompleted: tncComplete,
      isCurrent: currentStepId === "tnc",
    },
    {
      id: "approval",
      label: "Account approval",
      isCompleted: accountApprovalComplete,
      isCurrent: currentStepId === "approval",
    },
  ];
}

export function OnboardingStatusCard({ organization, userName }: OnboardingStatusCardProps) {
  const steps = getOnboardingSteps(organization);
  const allComplete = steps.every((step) => step.isCompleted);

  // Don't show if all steps are complete
  if (allComplete) {
    return null;
  }

  // Get display name
  const displayName = userName || (organization.type === "PERSONAL" 
    ? "Personal Account" 
    : organization.name || "Company Account");

  return (
    <div className="w-full">
      {/* Welcome header with action button */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome back, {displayName}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Apply for financing and manage your loans from your dashboard
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              {/* Step circle and label */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                    ${
                      step.isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : step.isCurrent
                        ? "bg-background border-primary border-[3px] ring-4 ring-primary/20"
                        : "bg-muted border-muted-foreground/30 text-muted-foreground"
                    }
                  `}
                >
                  {step.isCompleted ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : step.isCurrent ? (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs md:text-sm font-medium text-center max-w-[80px] md:max-w-[100px]
                    ${step.isCurrent ? "text-primary" : step.isCompleted ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 -mt-6">
                  <div
                    className={`h-full transition-all ${
                      step.isCompleted ? "bg-primary" : "bg-muted-foreground/30"
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

export { getOnboardingSteps };
export type { OnboardingStep };

