export function hasJsonContent(data: Record<string, unknown> | null | undefined): boolean {
  return Boolean(data && Object.keys(data).length > 0);
}

function displayAreaName(data: Record<string, unknown> | null | undefined): string {
  return typeof data?.displayArea === "string" ? data.displayArea.trim() : "";
}

/** Issuer COD historically stored PEP questions under wealth_declaration. */
function isTransactionInformationArea(data: Record<string, unknown> | null | undefined): boolean {
  return displayAreaName(data).toLowerCase() === "transaction information";
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
  const wealth = org.wealthDeclaration;
  const compliance = org.complianceDeclaration;
  const wealthIsTransaction = isTransactionInformationArea(wealth);
  const hasCompliance = hasJsonContent(compliance);
  const wealthForDisplay = wealthIsTransaction ? null : wealth;
  const complianceForDisplay = hasCompliance ? compliance : wealthIsTransaction ? wealth : compliance;
  const candidates: Array<{
    id: AdminOnboardingEvidenceCard["id"];
    label: string;
    data: Record<string, unknown> | null | undefined;
  }> = [
    { id: "wealth", label: ADMIN_ONBOARDING_EVIDENCE_LABELS.wealth, data: wealthForDisplay },
    { id: "documentInfo", label: ADMIN_ONBOARDING_EVIDENCE_LABELS.documentInfo, data: org.documentInfo },
    { id: "liveness", label: ADMIN_ONBOARDING_EVIDENCE_LABELS.liveness, data: org.livenessCheckInfo },
    { id: "compliance", label: ADMIN_ONBOARDING_EVIDENCE_LABELS.compliance, data: complianceForDisplay },
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
