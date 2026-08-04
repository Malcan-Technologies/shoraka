"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import {
  LegalDocumentsReview,
  PageShell,
  useHeader,
  legalDocumentsReviewCopy,
} from "@cashsouk/ui";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const copy = legalDocumentsReviewCopy("reacceptance");

export default function LegalUpdatesPage() {
  const router = useRouter();
  const { setTitle } = useHeader();
  const { activeOrganization } = useOrganization();

  const handleEmpty = useCallback(() => {
    router.replace("/");
  }, [router]);

  useEffect(() => {
    // PageShell owns the title.
    setTitle("");
    return () => setTitle("");
  }, [setTitle]);

  if (!activeOrganization) {
    return null;
  }

  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
      <PageShell title={copy.title} description={copy.description}>
        <LegalDocumentsReview
          organizationId={activeOrganization.id}
          portalType="issuer"
          apiUrl={API_URL}
          mode="reacceptance"
          embedInPageShell
          onComplete={() => router.push("/")}
          onEmptyReacceptance={handleEmpty}
        />
      </PageShell>
    </div>
  );
}
