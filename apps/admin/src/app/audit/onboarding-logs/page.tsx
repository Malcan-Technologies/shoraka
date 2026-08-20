import { redirect } from "next/navigation";

export default function OnboardingLogsRedirectPage() {
  redirect("/audit?tab=onboarding");
}
