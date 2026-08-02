"use client";

import * as React from "react";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import type { LegalBlockedAction, LegalComplianceStatus } from "@cashsouk/types";
import type { LegalReacceptancePortal } from "./legal-reacceptance-banner-copy";
import { shouldShowLegalReacceptanceBanner } from "./legal-reacceptance-banner-copy";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type LegalReacceptanceGateState = {
  loading: boolean;
  pending: boolean;
  isOwner: boolean;
  blockedActions: LegalBlockedAction[];
  /** Returns true when navigation should be redirected to /onboarding/terms. */
  shouldIntercept: (action: LegalBlockedAction) => boolean;
};

/**
 * Current-organization re-acceptance gate for new financing/investment CTAs.
 * Cache/scope is always the active organization ID.
 */
export function useLegalReacceptanceGate(
  portalType: LegalReacceptancePortal
): LegalReacceptanceGateState {
  const { activeOrganization } = useOrganization();
  const { getAccessToken } = useAuthToken();
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [isOwner, setIsOwner] = React.useState(false);
  const [blockedActions, setBlockedActions] = React.useState<LegalBlockedAction[]>([]);

  const eligible = shouldShowLegalReacceptanceBanner({
    hasOrganization: Boolean(activeOrganization),
    onboardingStatus: activeOrganization?.onboardingStatus,
    tncAccepted: activeOrganization?.tncAccepted,
    pathname: "/",
  });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!eligible || !activeOrganization) {
        setPending(false);
        setBlockedActions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
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
        if (cancelled || !result.success) return;
        setPending(result.data.hasPendingReacceptance);
        setIsOwner(result.data.isOrganisationOwner);
        setBlockedActions(result.data.blockedActions ?? []);
      } catch {
        if (!cancelled) {
          setPending(false);
          setBlockedActions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeOrganization?.id, eligible, getAccessToken, portalType]);

  const shouldIntercept = React.useCallback(
    (action: LegalBlockedAction) => pending && blockedActions.includes(action),
    [blockedActions, pending]
  );

  return {
    loading,
    pending,
    isOwner: isOwner || Boolean(activeOrganization?.isOwner),
    blockedActions,
    shouldIntercept,
  };
}

export const LEGAL_REACCEPTANCE_REDIRECT = "/onboarding/terms";

export function legalReacceptanceInterceptMessage(
  portalType: LegalReacceptancePortal
): string {
  if (portalType === "issuer") {
    return "Accept the latest legal documents before starting a new financing application.";
  }
  return "Accept the latest legal documents before making a new investment.";
}
