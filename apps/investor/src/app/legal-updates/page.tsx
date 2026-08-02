"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import { LegalReacceptancePanel, useHeader } from "@cashsouk/ui";

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
    <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
      <LegalReacceptancePanel
        organizationId={activeOrganization.id}
        portalType="investor"
        apiUrl={API_URL}
        onComplete={() => router.push("/")}
      />
    </div>
  );
}
