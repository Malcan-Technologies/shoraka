"use client";

import { PageShell } from "@cashsouk/ui";
import { filterVisiblePeopleRows } from "@cashsouk/types";
import { useOrganization } from "@cashsouk/config";
import { DirectorShareholderAlertCard } from "@/components/director-shareholder-alert-card";
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
  const visiblePeopleForDsGating = filterVisiblePeopleRows(activeOrganization?.people ?? []);

  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
      <PageShell
        title="Notes"
        description="Track note funding, disbursement, repayment status, and payment instructions."
      >
        {activeOrganization?.type === "COMPANY" ? (
          <DirectorShareholderAlertCard
            visiblePeople={visiblePeopleForDsGating}
            enabled={activeOrganization.onboardingStatus === "COMPLETED"}
            stickyTop
            className="mb-4"
          />
        ) : null}
        <IssuerProfileCompletenessBanner organizationId={activeOrganization?.id} onboarded={onboarded} />
        <IssuerNotesList />
      </PageShell>
    </div>
  );
}
