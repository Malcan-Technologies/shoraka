"use client";

import { PageShell } from "@cashsouk/ui";
import { IssuerNotesList } from "@/notes/components/issuer-notes-list";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

/**
 * Legacy notes list — permanently redirected to /financing?tab=notes.
 * Kept so the route module remains valid if the redirect is bypassed in tests.
 */
export default function IssuerNotesPage() {
  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
      <PageShell
        title="Notes"
        description="Track note funding, disbursement, repayment status, and payment instructions."
      >
        <IssuerNotesList />
      </PageShell>
    </div>
  );
}
