import { redirect } from "next/navigation";

export default async function InvestorProfileCompleteRedirectPage() {
  redirect("/profile?focus=completeness");
}
