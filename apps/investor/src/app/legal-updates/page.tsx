"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import {
  LegalDocumentsReview,
  PageShell,
  portalContentMaxWidthClassName,
  useHeader,
  legalDocumentsReviewCopy,
} from "@cashsouk/ui";
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-0">
      <div className={cn(portalContentMaxWidthClassName, "space-y-6 px-2 py-8 md:px-4")}>
        <PageShell title={copy.title} description={copy.description}>
          <LegalDocumentsReview
            organizationId={activeOrganization.id}
            portalType="investor"
            apiUrl={API_URL}
            mode="reacceptance"
            embedInPageShell
            onComplete={() => router.push("/")}
            onEmptyReacceptance={handleEmpty}
          />
        </PageShell>
      </div>
    </div>
  );
}
