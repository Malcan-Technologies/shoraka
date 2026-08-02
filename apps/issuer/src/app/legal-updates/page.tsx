"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import { LegalReacceptancePanel, useHeader } from "@cashsouk/ui";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LegalUpdatesPage() {
  const router = useRouter();
  const { setTitle } = useHeader();
  const { activeOrganization } = useOrganization();

  useEffect(() => {
    setTitle("Updated legal documents");
  }, [setTitle]);

  if (!activeOrganization) {
    return null;
  }

  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
      <LegalReacceptancePanel
        organizationId={activeOrganization.id}
        portalType="issuer"
        apiUrl={API_URL}
        onComplete={() => router.push("/")}
      />
    </div>
  );
}
