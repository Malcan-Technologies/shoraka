export function hasJsonContent(data: Record<string, unknown> | null | undefined): boolean {
  return Boolean(data && Object.keys(data).length > 0);
}

export const ADMIN_ONBOARDING_EVIDENCE_LABELS = {
  wealth: "Wealth Declaration",
  documentInfo: "Document Info",
  liveness: "Liveness Check Info",
  compliance: "Compliance Declaration",
} as const;

export type AdminOnboardingEvidenceCard = {
  id: keyof typeof ADMIN_ONBOARDING_EVIDENCE_LABELS;
  label: string;
  data: Record<string, unknown>;
};

export function adminOnboardingEvidenceCards(org: {
  wealthDeclaration?: Record<string, unknown> | null;
  documentInfo?: Record<string, unknown> | null;
  livenessCheckInfo?: Record<string, unknown> | null;
  complianceDeclaration?: Record<string, unknown> | null;
}): AdminOnboardingEvidenceCard[] {
  const candidates: Array<{
    id: AdminOnboardingEvidenceCard["id"];
    label: string;
    data: Record<string, unknown> | null | undefined;
  }> = [
    { id: "wealth", label: ADMIN_ONBOARDING_EVIDENCE_LABELS.wealth, data: org.wealthDeclaration },
    { id: "documentInfo", label: ADMIN_ONBOARDING_EVIDENCE_LABELS.documentInfo, data: org.documentInfo },
    { id: "liveness", label: ADMIN_ONBOARDING_EVIDENCE_LABELS.liveness, data: org.livenessCheckInfo },
    { id: "compliance", label: ADMIN_ONBOARDING_EVIDENCE_LABELS.compliance, data: org.complianceDeclaration },
  ];
  return candidates.filter((card): card is AdminOnboardingEvidenceCard => hasJsonContent(card.data));
}

export function hasOrganizationScreeningResponse(kycResponse: unknown): boolean {
  return kycResponse != null && typeof kycResponse === "object";
}

export const ADMIN_ORG_ADDRESS_FIELD_LABELS = {
  address: "Address",
  state: "State",
  postcode: "Postcode",
} as const;
