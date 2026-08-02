"use client";

import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import { LegalReacceptancePanel } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LegalUpdatesPage() {
  const router = useRouter();
  const { activeOrganization } = useOrganization();

  if (!activeOrganization) {
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <LegalReacceptancePanel
        organizationId={activeOrganization.id}
        portalType="investor"
        apiUrl={API_URL}
        onComplete={() => router.push("/")}
      />
    </main>
  );
}
