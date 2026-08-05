"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy placeholder Site Documents admin UI.
 * Legal document management lives at /legal-documents.
 * SiteDocument APIs remain available for non-legal guide workflows.
 */
export default function DocumentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/legal-documents");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirecting to Legal Documents…
    </div>
  );
}
