"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import type { LegalComplianceStatus } from "@cashsouk/types";
import { Button } from "../components/button";
import { cn } from "../lib/utils";
import {
  legalReacceptanceBannerCtaLabel,
  legalReacceptanceBannerDescription,
  legalReacceptanceBannerShellClassName,
  legalReacceptanceBannerTitle,
  shouldShowLegalReacceptanceBanner,
  type LegalReacceptancePortal,
} from "./legal-reacceptance-banner-copy";

export type { LegalReacceptancePortal };
export {
  legalReacceptanceBannerTitle,
  legalReacceptanceBannerDescription,
  legalReacceptanceBannerCtaLabel,
  legalReacceptanceBannerShellClassName,
  shouldShowLegalReacceptanceBanner,
} from "./legal-reacceptance-banner-copy";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function LegalReacceptanceBanner({
  portalType,
}: {
  portalType: LegalReacceptancePortal;
}) {
  const pathname = usePathname();
  const { activeOrganization } = useOrganization();
  const { getAccessToken } = useAuthToken();
  const [pending, setPending] = React.useState(false);
  const [isOrganisationOwner, setIsOrganisationOwner] = React.useState(false);

  const eligible = shouldShowLegalReacceptanceBanner({
    hasOrganization: Boolean(activeOrganization),
    onboardingStatus: activeOrganization?.onboardingStatus,
    tncAccepted: activeOrganization?.tncAccepted,
    pathname,
  });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!eligible || !activeOrganization) {
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
  }, [activeOrganization, eligible, getAccessToken, portalType]);

  if (!eligible || !pending || !activeOrganization) return null;

  const isOwner = isOrganisationOwner || Boolean(activeOrganization.isOwner);
  const title = legalReacceptanceBannerTitle(isOwner);
  const description = legalReacceptanceBannerDescription(portalType, isOwner);
  const ctaLabel = legalReacceptanceBannerCtaLabel(isOwner);

  return (
    <div
      className={legalReacceptanceBannerShellClassName(portalType)}
      role="status"
      aria-live="polite"
      data-testid="legal-reacceptance-banner"
    >
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3",
          "text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100",
          "sm:flex-row sm:items-center sm:gap-4"
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <ExclamationTriangleIcon
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-[15px] font-semibold leading-snug text-foreground">{title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button asChild size="sm" className="w-full shrink-0 sm:w-auto">
          <Link href="/legal-updates">{ctaLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
