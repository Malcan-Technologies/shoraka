"use client";

import { useMemo } from "react";
import type { Application } from "@cashsouk/types";
import { useOrganizationApplications } from "@/hooks/use-applications";
import {
  countPendingIssuerOfferReviewsAcross,
  type NormalizedApplication,
} from "@/app/(application-management)/applications/status";
import { prepareApplication } from "@/app/(application-management)/applications/use-applications-data";

type ApiApplication = Parameters<typeof prepareApplication>[0];

function normalizeApplicationsList(raw: Application[]): NormalizedApplication[] {
  return raw
    .map((app) => prepareApplication(app as ApiApplication))
    .filter((a) => a.status !== "archived");
}

/** Counts contract + invoice offers the issuer can still review (accept/sign/decline). */
export function useIssuerPendingOfferReviewCount(organizationId: string | undefined): number {
  const { data: apiApplications = [] } = useOrganizationApplications(organizationId);

  return useMemo(() => {
    if (!organizationId || apiApplications.length === 0) return 0;
    return countPendingIssuerOfferReviewsAcross(normalizeApplicationsList(apiApplications));
  }, [apiApplications, organizationId]);
}
