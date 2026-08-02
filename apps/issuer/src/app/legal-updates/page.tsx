"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Backward-compatible redirect — re-acceptance uses /onboarding/terms. */
export default function LegalUpdatesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding/terms");
  }, [router]);

  return null;
}
