import { OnboardingRouteGuard } from "@/components/onboarding-route-guard";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingRouteGuard portalType="issuer">{children}</OnboardingRouteGuard>;
}
