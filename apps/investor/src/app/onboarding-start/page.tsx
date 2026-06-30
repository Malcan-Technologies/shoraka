import { redirect } from "next/navigation";

export default function OnboardingStartRedirectPage() {
  redirect("/onboarding/account");
}
