"use client";

import * as React from "react";
import Link from "next/link";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import type { LegalComplianceStatus } from "@cashsouk/types";
import { Button } from "../components/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function LegalReacceptanceBanner({ portalType }: { portalType: "issuer" | "investor" }) {
  const { activeOrganization } = useOrganization();
  const { getAccessToken } = useAuthToken();
  const [pending, setPending] = React.useState(false);
  const [isOrganisationOwner, setIsOrganisationOwner] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activeOrganization?.tncAccepted) {
        setPending(false);
        return;
      }
      try {
        const client = createApiClient(API_URL, getAccessToken);
        const audience = portalType === "issuer" ? "ISSUER" : "INVESTOR";
        const query = new URLSearchParams({
          audience,
          organizationId: activeOrganization.id,
        });
        const result = await client.get<LegalComplianceStatus>(
          `/v1/legal-documents/acceptance-status?${query.toString()}`
        );
        if (!cancelled && result.success) {
          setPending(result.data.hasPendingReacceptance);
          setIsOrganisationOwner(result.data.isOrganisationOwner);
        }
      } catch {
        if (!cancelled) setPending(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeOrganization, getAccessToken, portalType]);

  if (!pending || !activeOrganization) return null;

  const isOwner = isOrganisationOwner || Boolean(activeOrganization.isOwner);

  return (
    <div
      className="border-b border-border bg-muted/60 px-4 py-3 md:px-6"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-foreground">
          {isOwner
            ? "An updated legal document requires your review and acceptance before you can start new transactions."
            : "The organisation owner must accept the updated legal document before new transactions can continue."}
        </p>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/legal-updates">{isOwner ? "Review documents" : "View documents"}</Link>
        </Button>
      </div>
    </div>
  );
}
