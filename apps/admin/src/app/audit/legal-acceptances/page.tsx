import { redirect } from "next/navigation";

export default function LegalAcceptancesAuditRedirectPage() {
  redirect("/audit?tab=legal-acceptances");
}
