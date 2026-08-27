import { redirect } from "next/navigation";

export default function LegalDocumentAcceptancesRedirectPage() {
  redirect("/audit?tab=legal-acceptances");
}
