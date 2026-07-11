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
jest.mock("../../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: jest.fn(),
  })),
}));

jest.mock("../aml-identity-repository", () => ({
  AmlIdentityRepository: jest.fn().mockImplementation(() => ({
    findByEodRequestId: jest.fn(),
    findByCodRequestId: jest.fn().mockResolvedValue([]),
    upsertMapping: jest.fn(),
    updateKycIdAndCopyToDuplicates: jest.fn(),
  })),
}));

const mockMaybeAdvance = jest.fn().mockResolvedValue({});
jest.mock("./org-aml-milestone", () => ({
  maybeAdvanceOrgAfterAmlScreeningCleared: (...args: unknown[]) => mockMaybeAdvance(...args),
}));

jest.mock("../../admin/guarantor-aml-webhook-sync", () => ({
  syncApplicationGuarantorsFromRegTankAmlWebhook: jest.fn().mockResolvedValue(0),
}));

jest.mock("../../organization/ctos-party-kyb-link", () => ({
  linkCtosPartyToKyb: jest.fn(),
}));

jest.mock("../../organization/ctos-party-supplement-webhook-lookup", () => ({
  findCtosPartySupplementByOnboardingJsonMatch: jest.fn().mockResolvedValue(null),
}));

const mockInvestorUpdate = jest.fn().mockResolvedValue({});
const mockOnboardingLogCreate = jest.fn().mockResolvedValue({});
jest.mock("../../../lib/prisma", () => ({
  prisma: {
    investorOrganization: { update: (...args: unknown[]) => mockInvestorUpdate(...args) },
    issuerOrganization: { update: jest.fn() },
    onboardingLog: { create: (...args: unknown[]) => mockOnboardingLogCreate(...args) },
    regTankOnboarding: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import { KYCWebhookHandler } from "./kyc-handler";

function baseOnboardingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    request_id: "LD001-R01",
    status: "WAIT_FOR_APPROVAL",
    onboarding_type: "INDIVIDUAL",
    organization_type: OrganizationType.PERSONAL,
    investor_organization_id: "org-1",
    issuer_organization_id: null,
    portal_type: "investor",
    user_id: "user-1",
    ...overrides,
  };
}

describe("KYCWebhookHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("A1: KYC Approved does not overwrite the onboarding lifecycle status (e.g. WAIT_FOR_APPROVAL)", async () => {
    const onboarding = baseOnboardingRow({ status: "WAIT_FOR_APPROVAL" });
    mockFindByRequestId.mockResolvedValue(onboarding);
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC001",
      onboardingId: "LD001-R01",
      status: "Approved",
    });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    // kyc_response is stored, but reg_tank_onboarding.status is untouched.
    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kyc_response: expect.anything() }) })
    );
  });

  it("A2: KYC unknown/undocumented status is preserved but does not alter onboarding lifecycle status", async () => {
    const onboarding = baseOnboardingRow({ status: "APPROVED" });
    mockFindByRequestId.mockResolvedValue(onboarding);
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC001",
      onboardingId: "LD001-R01",
      status: "Some New Undocumented Status",
    });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("E11: cancelled onboarding preserves the KYC payload but skips AML milestone updates", async () => {
    const onboarding = baseOnboardingRow({ status: "CANCELLED" });
    mockFindByRequestId.mockResolvedValue(onboarding);
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC001",
      onboardingId: "LD001-R01",
      status: "Approved",
    });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
    expect(mockMaybeAdvance).not.toHaveBeenCalled();
  });

  it("G1: personal investor's own INDIVIDUAL onboarding APPROVED triggers the personal AML milestone", async () => {
    const onboarding = baseOnboardingRow({
      status: "WAIT_FOR_APPROVAL",
      onboarding_type: "INDIVIDUAL",
      organization_type: OrganizationType.PERSONAL,
    });
    mockFindByRequestId.mockResolvedValue(onboarding);
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC001",
      onboardingId: "LD001-R01",
      status: "Approved",
    });

    expect(mockMaybeAdvance).toHaveBeenCalledTimes(1);
    expect(mockMaybeAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", portalType: "investor" })
    );
  });

  it("G2: a director/shareholder KYC resolved against the parent CORPORATE onboarding does NOT trigger the personal AML milestone", async () => {
    const onboarding = baseOnboardingRow({
      status: "WAIT_FOR_APPROVAL",
      request_id: "COD001-R01",
      onboarding_type: "CORPORATE",
      organization_type: OrganizationType.COMPANY,
    });
    mockFindByRequestId.mockResolvedValue(onboarding);
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC002",
      onboardingId: "COD001-R01",
      status: "Approved",
    });

    expect(mockMaybeAdvance).not.toHaveBeenCalled();
  });

  it("G3: an INDIVIDUAL onboarding row on a COMPANY-type organization does NOT trigger the personal AML milestone", async () => {
    const onboarding = baseOnboardingRow({
      status: "WAIT_FOR_APPROVAL",
      onboarding_type: "INDIVIDUAL",
      organization_type: OrganizationType.COMPANY,
    });
    mockFindByRequestId.mockResolvedValue(onboarding);
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC003",
      onboardingId: "LD001-R01",
      status: "Approved",
    });

    expect(mockMaybeAdvance).not.toHaveBeenCalled();
  });
});
