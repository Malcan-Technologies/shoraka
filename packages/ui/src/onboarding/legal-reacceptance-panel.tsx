"use client";

import { LegalDocumentsReview } from "./legal-documents-review";
import type { PortalType } from "@cashsouk/config";

export interface LegalReacceptancePanelProps {
  organizationId: string;
  portalType: PortalType;
  apiUrl: string;
  onComplete?: () => void;
}

/** @deprecated Prefer LegalDocumentsReview with mode="reacceptance". */
export function LegalReacceptancePanel({
  organizationId,
  portalType,
  apiUrl,
  onComplete,
}: LegalReacceptancePanelProps) {
  return (
    <LegalDocumentsReview
      organizationId={organizationId}
      portalType={portalType}
      apiUrl={apiUrl}
      mode="reacceptance"
      onComplete={onComplete}
      onEmptyReacceptance={onComplete}
    />
  );
}
