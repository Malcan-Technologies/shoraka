"use client";

import { PageShell } from "@cashsouk/ui";
import { useOrganization } from "@cashsouk/config";
import { IssuerNotesList } from "@/notes/components/issuer-notes-list";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import { IssuerProfileCompletenessBanner } from "@/components/profile-completeness-banner";

/**
 * Legacy notes list — permanently redirected to /financing?tab=invoices.
 * Kept so the route module remains valid if the redirect is bypassed in tests.
 */
export default function IssuerNotesPage() {
  const { activeOrganization } = useOrganization();
  const onboarded = activeOrganization?.onboardingStatus === "COMPLETED";

  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
      <PageShell
        title="Notes"
        description="Track note funding, disbursement, repayment status, and payment instructions."
      >
        <IssuerProfileCompletenessBanner organizationId={activeOrganization?.id} onboarded={onboarded} />
        <IssuerNotesList />
      </PageShell>
    </div>
  );
}
