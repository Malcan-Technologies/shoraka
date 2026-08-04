"use client";

import { LegalDocumentsReview } from "./legal-documents-review";
import type { PortalType } from "@cashsouk/config";

export interface LegalDocumentsAcceptanceProps {
  organizationId: string;
  portalType: PortalType;
  apiUrl: string;
  onAccepted?: () => void;
}

/** @deprecated Prefer LegalDocumentsReview with mode="onboarding". */
export function LegalDocumentsAcceptance({
  organizationId,
  portalType,
  apiUrl,
  onAccepted,
}: LegalDocumentsAcceptanceProps) {
  return (
    <LegalDocumentsReview
      organizationId={organizationId}
      portalType={portalType}
      apiUrl={apiUrl}
      mode="onboarding"
      onComplete={onAccepted}
    />
  );
}
