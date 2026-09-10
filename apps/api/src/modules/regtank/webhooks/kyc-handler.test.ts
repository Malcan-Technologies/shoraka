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
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        investorOrganization: { update: (...args: unknown[]) => mockInvestorUpdate(...args) },
        issuerOrganization: { update: jest.fn() },
        onboardingLog: { create: (...args: unknown[]) => mockOnboardingLogCreate(...args) },
      })
    ),
    investorOrganization: { update: (...args: unknown[]) => mockInvestorUpdate(...args) },
    issuerOrganization: { update: jest.fn() },
    onboardingLog: { create: (...args: unknown[]) => mockOnboardingLogCreate(...args) },
    regTankOnboarding: { findMany: jest.fn().mockResolvedValue([]) },
    ctosPartySupplement: { update: jest.fn().mockResolvedValue({}) },
  },
}));

import { KYCWebhookHandler } from "./kyc-handler";
import { linkCtosPartyToKyb } from "../../organization/ctos-party-kyb-link";
import { findCtosPartySupplementByOnboardingJsonMatch } from "../../organization/ctos-party-supplement-webhook-lookup";

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
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue(null);
    (linkCtosPartyToKyb as jest.Mock).mockResolvedValue(undefined);
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

  it("C1: issuer party APPROVED + KYC webhook calls association", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "user:1",
      issuer_organization_id: "org-iss",
      investor_organization_id: null,
      onboarding_json: {
        requestId: "LD001-R01",
        status: "APPROVED",
        screening: null,
      },
    });
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC001",
      onboardingId: "LD001-R01",
      referenceId: "org-iss_user1",
      status: "Pending",
    });

    expect(linkCtosPartyToKyb).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-iss",
        partyKey: "user:1",
        portalType: "issuer",
        onboardingJson: expect.objectContaining({
          status: "APPROVED",
          screening: expect.objectContaining({ requestId: "KYC001" }),
        }),
      })
    );
  });

  it("C2: investor party APPROVED + KYC webhook calls association", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-2",
      party_key: "user:2",
      issuer_organization_id: null,
      investor_organization_id: "org-inv",
      onboarding_json: {
        requestId: "LD002-R01",
        status: "APPROVED",
        screening: null,
      },
    });
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC002",
      onboardingId: "LD002-R01",
      referenceId: "org-inv_user2",
      status: "Pending",
    });

    expect(linkCtosPartyToKyb).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-inv",
        partyKey: "user:2",
        portalType: "investor",
      })
    );
  });

  it("C3: WAIT_FOR_APPROVAL stores KYC ID but does not associate yet", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-3",
      party_key: "user:3",
      issuer_organization_id: "org-iss",
      investor_organization_id: null,
      onboarding_json: {
        requestId: "LD003-R01",
        status: "WAIT_FOR_APPROVAL",
        screening: null,
      },
    });
    const handler = new KYCWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYC003",
      onboardingId: "LD003-R01",
      status: "Pending",
    });

    expect(linkCtosPartyToKyb).not.toHaveBeenCalled();
  });
});
