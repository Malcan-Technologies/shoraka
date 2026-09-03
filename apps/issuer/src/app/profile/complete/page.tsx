import { redirect } from "next/navigation";

export default async function IssuerProfileCompleteRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  const focus =
    step === "financials"
      ? "financials"
      : step === "people"
        ? "people"
        : step === "company"
          ? "company"
          : "completeness";
  redirect(`/profile?focus=${focus}`);
}
