import { OnboardingStatus } from "@prisma/client";

// Trivial stubs for constructor deps not exercised by these tests.
jest.mock("./repository", () => ({ AdminRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../notification/service", () => ({ NotificationService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../products/repository", () => ({ ProductRepository: jest.fn().mockImplementation(() => ({})) }));

const mockQueryOnboardingDetails = jest.fn();
const mockGetCorporateOnboardingDetails = jest.fn();
jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({
    queryOnboardingDetails: (...args: unknown[]) => mockQueryOnboardingDetails(...args),
    getCorporateOnboardingDetails: (...args: unknown[]) => mockGetCorporateOnboardingDetails(...args),
  })),
}));

const mockUpdateStatus = jest.fn(() => Promise.resolve());
jest.mock("../regtank/repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  })),
}));

const mockHandleWebhookUpdate = jest.fn(() => Promise.resolve());
jest.mock("../regtank/service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({
    handleWebhookUpdate: (...args: unknown[]) => mockHandleWebhookUpdate(...args),
  })),
}));

const mockUpdateInvestorOrganizationOnboarding = jest.fn(() => Promise.resolve());
const mockUpdateIssuerOrganizationOnboarding = jest.fn(() => Promise.resolve());
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    updateInvestorOrganizationOnboarding: (...args: unknown[]) =>
      mockUpdateInvestorOrganizationOnboarding(...args),
    updateIssuerOrganizationOnboarding: (...args: unknown[]) =>
      mockUpdateIssuerOrganizationOnboarding(...args),
  })),
}));

const mockApplyPersonalAmlMilestoneFromLiveKyc = jest.fn();
const mockApplyCorporateAmlMilestoneFromLiveKyb = jest.fn();
jest.mock("../regtank/webhooks/org-aml-milestone", () => ({
  applyPersonalAmlMilestoneFromLiveKyc: (...args: unknown[]) =>
    mockApplyPersonalAmlMilestoneFromLiveKyc(...args),
  applyCorporateAmlMilestoneFromLiveKyb: (...args: unknown[]) =>
    mockApplyCorporateAmlMilestoneFromLiveKyb(...args),
}));

const mockFetchAllAMLStatuses = jest.fn(() => Promise.resolve());
jest.mock("../regtank/aml-fetcher", () => ({
  AMLFetcherService: jest.fn().mockImplementation(() => ({
    fetchAllAMLStatuses: (...args: unknown[]) => mockFetchAllAMLStatuses(...args),
  })),
}));

const mockRegTankOnboardingFindUnique = jest.fn();
const mockInvestorOrgFindUnique = jest.fn();
const mockIssuerOrgFindUnique = jest.fn();
const mockInvestorOrgUpdate = jest.fn(() => Promise.resolve());
const mockIssuerOrgUpdate = jest.fn(() => Promise.resolve());
const mockOnboardingLogCreate = jest.fn(() => Promise.resolve());
jest.mock("../../lib/prisma", () => ({
  prisma: {
    regTankOnboarding: {
      findUnique: (...args: unknown[]) => mockRegTankOnboardingFindUnique(...args),
    },
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorOrgFindUnique(...args),
      update: (...args: unknown[]) => mockInvestorOrgUpdate(...args),
    },
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerOrgFindUnique(...args),
      update: (...args: unknown[]) => mockIssuerOrgUpdate(...args),
    },
    onboardingLog: {
      create: (...args: unknown[]) => mockOnboardingLogCreate(...args),
    },
  },
}));

import { AdminService } from "./service";

function personalOnboarding(overrides: Record<string, unknown> = {}) {
  return {
    id: "onboarding-1",
    request_id: "LD001",
    reference_id: "ref-1",
    onboarding_type: "INDIVIDUAL",
    portal_type: "investor",
    status: "WAIT_FOR_APPROVAL",
    investor_organization: {
      id: "org-1",
      name: "Jane Doe",
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      onboarding_approved: false,
      aml_approved: false,
      kyc_id: null,
    },
    issuer_organization: null,
    ...overrides,
  };
}

function corporateOnboarding(overrides: Record<string, unknown> = {}) {
  return {
    id: "onboarding-2",
    request_id: "COD001",
    reference_id: "ref-2",
    onboarding_type: "CORPORATE",
    portal_type: "investor",
    status: "WAIT_FOR_APPROVAL",
    investor_organization: {
      id: "org-2",
      name: "Acme Sdn Bhd",
      onboarding_status: OnboardingStatus.PENDING_AML,
      onboarding_approved: true,
      aml_approved: false,
      ssm_approved: true,
    },
    issuer_organization: null,
    ...overrides,
  };
}

describe("AdminService.refreshOnboardingStatus — personal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("advances when individual onboarding is APPROVED and KYC is approved", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      personalOnboarding({
        investor_organization: {
          id: "org-1",
          name: "Jane Doe",
          onboarding_status: OnboardingStatus.PENDING_APPROVAL,
          onboarding_approved: false,
          aml_approved: false,
          kyc_id: "KYC001",
        },
      })
    );
    mockQueryOnboardingDetails.mockResolvedValue({ status: "APPROVED" });
    mockInvestorOrgFindUnique.mockResolvedValue({
      onboarding_status: OnboardingStatus.PENDING_AML,
      onboarding_approved: true,
      aml_approved: false,
      kyc_id: "KYC001",
      name: "Jane Doe",
    });
    mockApplyPersonalAmlMilestoneFromLiveKyc.mockResolvedValue({
      approved: true,
      amlApproved: true,
      onboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
      advanced: true,
      rawStatus: "Approved",
    });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-1", "admin-1");

    expect(mockHandleWebhookUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "LD001", status: "APPROVED" })
    );
    expect(mockApplyPersonalAmlMilestoneFromLiveKyc).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", kycId: "KYC001", userId: "admin-1" })
    );
    expect(result.advanced).toBe(true);
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_FINAL_APPROVAL);
    expect(result.amlApproved).toBe(true);
    expect(result.message).toContain("Final Approval");
  });

  it("keeps the organization pending when RegTank onboarding is still WAIT_FOR_APPROVAL", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(personalOnboarding());
    mockQueryOnboardingDetails.mockResolvedValue({ status: "WAIT_FOR_APPROVAL" });
    mockInvestorOrgFindUnique.mockResolvedValue({
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      onboarding_approved: true,
      aml_approved: false,
      kyc_id: null,
      name: "Jane Doe",
    });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-1", "admin-1");

    expect(mockHandleWebhookUpdate).not.toHaveBeenCalled();
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_APPROVAL);
    expect(result.advanced).toBe(false);
    expect(result.message).toContain("still pending");
  });

  it("does not set aml_approved when the live KYC screening is still pending", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      personalOnboarding({
        investor_organization: {
          id: "org-1",
          name: "Jane Doe",
          onboarding_status: OnboardingStatus.PENDING_AML,
          onboarding_approved: true,
          aml_approved: false,
          kyc_id: "KYC001",
        },
      })
    );
    mockQueryOnboardingDetails.mockResolvedValue({ status: "APPROVED" });
    mockInvestorOrgFindUnique.mockResolvedValue({
      onboarding_status: OnboardingStatus.PENDING_AML,
      onboarding_approved: true,
      aml_approved: false,
      kyc_id: "KYC001",
      name: "Jane Doe",
    });
    mockApplyPersonalAmlMilestoneFromLiveKyc.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
      rawStatus: "Unresolved",
    });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-1", "admin-1");

    expect(result.amlApproved).toBe(false);
    expect(result.advanced).toBe(false);
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_AML);
  });

  it("does not advance on an unknown/undocumented KYC status", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      personalOnboarding({
        investor_organization: {
          id: "org-1",
          name: "Jane Doe",
          onboarding_status: OnboardingStatus.PENDING_AML,
          onboarding_approved: true,
          aml_approved: false,
          kyc_id: "KYC001",
        },
      })
    );
    mockQueryOnboardingDetails.mockResolvedValue({ status: "APPROVED" });
    mockInvestorOrgFindUnique.mockResolvedValue({
      onboarding_status: OnboardingStatus.PENDING_AML,
      onboarding_approved: true,
      aml_approved: false,
      kyc_id: "KYC001",
      name: "Jane Doe",
    });
    mockApplyPersonalAmlMilestoneFromLiveKyc.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
      rawStatus: "SomeNewUndocumentedStatus",
    });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-1", "admin-1");

    expect(result.advanced).toBe(false);
    expect(result.amlApproved).toBe(false);
  });

  it("returns a clear warning instead of a misleading COD error when kyc_id is missing", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(personalOnboarding());
    mockQueryOnboardingDetails.mockResolvedValue({ status: "PROCESSING" });
    mockInvestorOrgFindUnique.mockResolvedValue({
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      onboarding_approved: false,
      aml_approved: false,
      kyc_id: null,
      name: "Jane Doe",
    });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-1", "admin-1");

    expect(mockApplyPersonalAmlMilestoneFromLiveKyc).not.toHaveBeenCalled();
    expect(result.warnings.some((w) => w.toLowerCase().includes("kyc"))).toBe(true);
    expect(result.partialFailures).not.toContain("COD");
  });

  it("recovers a missed APPROVED webhook via refresh", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      personalOnboarding({
        investor_organization: {
          id: "org-1",
          name: "Jane Doe",
          onboarding_status: OnboardingStatus.PENDING_APPROVAL,
          onboarding_approved: false,
          aml_approved: false,
          kyc_id: null,
        },
      })
    );
    mockQueryOnboardingDetails.mockResolvedValue({ status: "APPROVED" });
    mockInvestorOrgFindUnique.mockResolvedValue({
      onboarding_status: OnboardingStatus.PENDING_AML,
      onboarding_approved: true,
      aml_approved: false,
      kyc_id: null,
      name: "Jane Doe",
    });

    const service = new AdminService();
    await service.refreshOnboardingStatus({} as never, "onboarding-1", "admin-1");

    expect(mockHandleWebhookUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "LD001", status: "APPROVED", referenceId: "ref-1" })
    );
  });
});

describe("AdminService.refreshOnboardingStatus — company", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not re-query RegTank for a COMPLETED organization", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      corporateOnboarding({
        investor_organization: {
          id: "org-2",
          name: "Acme Sdn Bhd",
          onboarding_status: OnboardingStatus.COMPLETED,
          onboarding_approved: true,
          aml_approved: true,
          ssm_approved: true,
        },
      })
    );
    mockInvestorOrgFindUnique.mockResolvedValue({ ssm_approved: true });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-2", "admin-1");

    expect(mockGetCorporateOnboardingDetails).not.toHaveBeenCalled();
    expect(mockApplyCorporateAmlMilestoneFromLiveKyb).not.toHaveBeenCalled();
    expect(result.onboardingStatus).toBe(OnboardingStatus.COMPLETED);
    expect(result.advanced).toBe(false);
  });

  it("does not re-query RegTank for a REJECTED organization", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      corporateOnboarding({
        investor_organization: {
          id: "org-2",
          name: "Acme Sdn Bhd",
          onboarding_status: OnboardingStatus.REJECTED,
          onboarding_approved: false,
          aml_approved: false,
          ssm_approved: false,
        },
      })
    );
    mockInvestorOrgFindUnique.mockResolvedValue({ ssm_approved: false });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-2", "admin-1");

    expect(mockGetCorporateOnboardingDetails).not.toHaveBeenCalled();
    expect(result.onboardingStatus).toBe(OnboardingStatus.REJECTED);
  });

  it("never sets ssmApproved automatically — reflects only the existing stored flag", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(corporateOnboarding());
    mockGetCorporateOnboardingDetails.mockResolvedValue({ status: "WAIT_FOR_APPROVAL", corpIndvDirectors: [] });
    // Same mock backs both the director_aml_status lookup (inside refreshCorporateAmlStatus)
    // and the ssm_approved lookup (orchestrator's readSsmApproved) — both fields present.
    mockInvestorOrgFindUnique.mockResolvedValue({
      director_aml_status: { directors: [] },
      ssm_approved: true,
    });
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-2", "admin-1");

    expect(result.ssmApproved).toBe(true);
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_AML);
  });

  it("reports partial failure when EOD/KYB refresh fails but preserves the COD result", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(corporateOnboarding());
    mockGetCorporateOnboardingDetails.mockResolvedValue({ status: "WAIT_FOR_APPROVAL", corpIndvDirectors: [] });
    mockInvestorOrgFindUnique.mockResolvedValue({ ssm_approved: true });
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockRejectedValue(new Error("RegTank KYB timeout"));

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus({} as never, "onboarding-2", "admin-1");

    expect(result.partialFailures).toContain("KYB");
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_AML);
  });
});
