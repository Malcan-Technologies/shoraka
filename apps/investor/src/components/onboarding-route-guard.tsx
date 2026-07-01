"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useOrganization,
  getOnboardingStep,
  getOnboardingStepRoute,
  getOnboardingRouteStep,
  type PortalType,
} from "@cashsouk/config";

interface OnboardingRouteGuardProps {
  children: React.ReactNode;
  portalType: PortalType;
}

export function OnboardingRouteGuard({ children, portalType }: OnboardingRouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeOrganization, isLoading } = useOrganization();

  useEffect(() => {
    if (isLoading) return;

    const routeStep = getOnboardingRouteStep(pathname);
    if (!routeStep) return;

    // Adding a new org always starts on the account step.
    if (routeStep === "account") return;

    if (!activeOrganization) {
      router.replace("/onboarding/account");
      return;
    }

    const expectedStep = getOnboardingStep(activeOrganization, portalType);
    const expectedRoute = getOnboardingStepRoute(expectedStep);

    if (expectedRoute === "/") {
      router.replace("/");
      return;
    }

    const expectedRouteStep = getOnboardingRouteStep(expectedRoute);
    if (expectedRouteStep && routeStep !== expectedRouteStep) {
      router.replace(expectedRoute);
    }
  }, [pathname, activeOrganization, isLoading, router, portalType]);

  return <>{children}</>;
}
