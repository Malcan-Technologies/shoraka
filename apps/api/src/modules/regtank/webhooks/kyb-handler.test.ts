import { OrganizationType } from "@prisma/client";

const mockFindByRequestId = jest.fn();
const mockFindByReferenceId = jest.fn().mockResolvedValue(null);
const mockAppendWebhookPayload = jest.fn().mockResolvedValue(undefined);
const mockUpdateStatus = jest.fn().mockResolvedValue({});

jest.mock("../repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findByRequestId: (...args: unknown[]) => mockFindByRequestId(...args),
    findByReferenceId: (...args: unknown[]) => mockFindByReferenceId(...args),
    appendWebhookPayload: (...args: unknown[]) => mockAppendWebhookPayload(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  })),
}));

const mockFindInvestorOrganizationById = jest.fn().mockResolvedValue({ id: "org-1", name: "Test Org" });
const mockFindIssuerOrganizationById = jest.fn().mockResolvedValue({ id: "org-issuer-1", name: "Issuer Co" });
jest.mock("../../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: (...args: unknown[]) => mockFindIssuerOrganizationById(...args),
  })),
}));

jest.mock("../aml-identity-repository", () => ({
  AmlIdentityRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../api-client", () => ({
  getRegTankAPIClient: () => ({
    getCorporateOnboardingDetails: jest.fn(),
  }),
}));

const mockMaybeAdvance = jest.fn().mockResolvedValue({});
jest.mock("./org-aml-milestone", () => ({
  maybeAdvanceOrgAfterAmlScreeningCleared: (...args: unknown[]) => mockMaybeAdvance(...args),
}));

jest.mock("../../admin/guarantor-aml-webhook-sync", () => ({
  syncApplicationGuarantorsFromRegTankAmlWebhook: jest.fn().mockResolvedValue(0),
}));

jest.mock("../helpers/corporate-shareholder-status-sync", () => ({
  syncCorporateShareholderStatusInOrganization: jest.fn(),
}));

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    investorOrganization: { update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    issuerOrganization: { update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import { KYBWebhookHandler } from "./kyb-handler";

function baseCodOnboardingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    request_id: "COD001",
    status: "PENDING_APPROVAL",
    onboarding_type: "CORPORATE",
    organization_type: OrganizationType.COMPANY,
    investor_organization_id: "org-1",
    issuer_organization_id: null,
    portal_type: "investor",
    user_id: "user-1",
    ...overrides,
  };
}

describe("KYBWebhookHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("B3: KYB Approved does not overwrite the COD onboarding lifecycle status", async () => {
    mockFindByRequestId.mockResolvedValue(baseCodOnboardingRow());
    const handler = new KYBWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYB001",
      onboardingId: "COD001",
      status: "Approved",
    });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    // Main-company KYB Approved still runs the AML milestone helper (unchanged behavior).
    expect(mockMaybeAdvance).toHaveBeenCalledTimes(1);
    expect(mockMaybeAdvance).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        portalType: "investor",
        trigger: "REGTANK_KYB_MAIN_COMPANY_APPROVED",
        onboardingId: "row-1",
        extraMetadata: expect.objectContaining({
          kybRequestId: "KYB001",
          onboardingRequestId: "COD001",
        }),
      })
    );
  });

  it("issuer company main-company KYB Approved passes reg_tank_onboarding.id, not the COD/KYB provider ids", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseCodOnboardingRow({
        id: "issuer-onboarding-1",
        request_id: "COD05463",
        investor_organization_id: null,
        issuer_organization_id: "org-issuer-1",
        portal_type: "issuer",
      })
    );
    const handler = new KYBWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYB00103",
      onboardingId: "COD05463",
      status: "Approved",
    });

    expect(mockMaybeAdvance).toHaveBeenCalledTimes(1);
    expect(mockMaybeAdvance).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-issuer-1",
        portalType: "issuer",
        trigger: "REGTANK_KYB_MAIN_COMPANY_APPROVED",
        onboardingId: "issuer-onboarding-1",
        extraMetadata: expect.objectContaining({
          kybRequestId: "KYB00103",
          onboardingRequestId: "COD05463",
        }),
      })
    );
    const call = mockMaybeAdvance.mock.calls[0]?.[0] as { onboardingId?: string };
    expect(call.onboardingId).not.toBe("COD05463");
    expect(call.onboardingId).not.toBe("KYB00103");
  });

  it("B4: KYB unknown status is preserved but does not alter onboarding lifecycle status", async () => {
    mockFindByRequestId.mockResolvedValue(baseCodOnboardingRow());
    const handler = new KYBWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYB001",
      onboardingId: "COD001",
      status: "Some Undocumented KYB Status",
    });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockMaybeAdvance).not.toHaveBeenCalled();
  });
});
