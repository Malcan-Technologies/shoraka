import { redirect } from "next/navigation";

export default async function IssuerProfileCompleteRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  if (step === "people") {
    redirect("/profile?tab=people");
  }
  const focus =
    step === "financials"
      ? "financials"
      : step === "company"
        ? "company"
        : "completeness";
  redirect(`/profile?focus=${focus}`);
}
