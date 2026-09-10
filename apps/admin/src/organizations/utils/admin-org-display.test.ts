import {
  ADMIN_ORG_ADDRESS_FIELD_LABELS,
  adminOnboardingEvidenceCards,
  hasOrganizationScreeningResponse,
} from "./admin-org-display";

describe("adminOnboardingEvidenceCards", () => {
  it("renders Wealth Declaration when the DTO contains JSON content", () => {
    const cards = adminOnboardingEvidenceCards({
      wealthDeclaration: { content: [{ fieldName: "sourceOfWealth", fieldValue: "Employment" }] },
    });
    expect(cards.map((card) => card.label)).toEqual(["Wealth Declaration"]);
  });

  it("keeps Document Info, Liveness, and Compliance when those JSON objects exist", () => {
    const cards = adminOnboardingEvidenceCards({
      documentInfo: { documentType: "NRIC" },
      livenessCheckInfo: { status: "PASS" },
      complianceDeclaration: { agreed: true },
    });
    expect(cards.map((card) => card.label)).toEqual([
      "Document Info",
      "Liveness Check Info",
      "Compliance Declaration",
    ]);
  });

  it("does not invent Wealth Declaration when seed data is missing or empty", () => {
    expect(adminOnboardingEvidenceCards({})).toEqual([]);
    expect(adminOnboardingEvidenceCards({ wealthDeclaration: null })).toEqual([]);
    expect(adminOnboardingEvidenceCards({ wealthDeclaration: {} })).toEqual([]);
  });
});

describe("hasOrganizationScreeningResponse", () => {
  it("is true when kycResponse exists", () => {
    expect(hasOrganizationScreeningResponse({ status: "APPROVED", riskLevel: "LOW" })).toBe(true);
  });

  it("is false only when source data is absent", () => {
    expect(hasOrganizationScreeningResponse(null)).toBe(false);
    expect(hasOrganizationScreeningResponse(undefined)).toBe(false);
  });
});

describe("ADMIN_ORG_ADDRESS_FIELD_LABELS", () => {
  it("uses short field labels under Registered and Business Address headings", () => {
    expect(ADMIN_ORG_ADDRESS_FIELD_LABELS).toEqual({
      address: "Address",
      state: "State",
      postcode: "Postcode",
    });
  });
});
