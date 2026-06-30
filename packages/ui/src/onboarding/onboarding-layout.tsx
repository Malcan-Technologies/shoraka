"use client";

import * as React from "react";
import { useEffect } from "react";
import type { Organization, PortalType } from "@cashsouk/config";
import { getOnboardingStepperSteps, type OnboardingFlowStep } from "@cashsouk/config";
import { cn } from "../lib/utils";
import { Logo } from "../components/logo";
import { OnboardingStepper } from "./onboarding-stepper";
import { useHeader } from "../components/header-provider";

interface OnboardingLayoutProps {
  organization: Organization | null;
  portalType: PortalType;
  currentRouteStep?: OnboardingFlowStep;
  title?: string;
  description?: string;
  /** centered: welcome/account; page: full-width; step-centered: stepper + compact centered body */
  variant?: "centered" | "page" | "step-centered";
  children: React.ReactNode;
}

function getPageGutterClass(portalType: PortalType): string {
  if (portalType === "issuer") {
    return "w-full min-w-0 space-y-6 px-6 pt-6 pb-10 sm:space-y-8 sm:px-8 sm:pt-8 sm:pb-12 lg:px-10";
  }
  return "w-full min-w-0 space-y-6 p-4 pt-0 md:space-y-8 md:p-6 md:pt-0";
}

function getStepperGutterClass(portalType: PortalType): string {
  if (portalType === "issuer") {
    return "w-full min-w-0 px-6 pt-6 sm:px-8 sm:pt-8 lg:px-10";
  }
  return "w-full min-w-0 p-4 pt-0 md:p-6 md:pt-0";
}

export function OnboardingLayout({
  organization,
  portalType,
  currentRouteStep,
  title,
  description,
  variant = "page",
  children,
}: OnboardingLayoutProps) {
  const { setTitle } = useHeader();
  const steps = organization
    ? getOnboardingStepperSteps(organization, portalType, currentRouteStep)
    : [];

  useEffect(() => {
    if (variant === "page" || variant === "step-centered") {
      setTitle("Onboarding");
    }
  }, [setTitle, variant]);

  if (variant === "centered") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
        <div className="flex w-full max-w-md flex-col items-center space-y-8">
          <Logo />
          {children}
        </div>
      </div>
    );
  }

  if (variant === "step-centered") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {organization && steps.length > 0 ? (
          <div className={getStepperGutterClass(portalType)}>
            <OnboardingStepper steps={steps} />
          </div>
        ) : null}

        <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4 pb-10 sm:pb-12">
          <div className="w-full max-w-md space-y-6">
            {(title || description) && (
              <div className="space-y-2 text-center">
                {title ? <h1 className="text-xl font-semibold">{title}</h1> : null}
                {description ? (
                  <p className="text-[15px] leading-7 text-muted-foreground">{description}</p>
                ) : null}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn(getPageGutterClass(portalType))}>
        {organization && steps.length > 0 ? <OnboardingStepper steps={steps} /> : null}

        {(title || description) && (
          <div className="space-y-2">
            {title ? <h1 className="text-2xl font-bold md:text-3xl">{title}</h1> : null}
            {description ? (
              <p className="text-[15px] leading-7 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
