import { OnboardingStatus, OrganizationType } from "@prisma/client";

const mockFindInvestorOrganizationById = jest.fn();
const mockFindIssuerOrganizationById = jest.fn();

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: (...args: unknown[]) => mockFindIssuerOrganizationById(...args),
  })),
}));

const mockFindByOrganization = jest.fn(() => Promise.resolve([]));
const mockUpsertMapping = jest.fn(() => Promise.resolve({}));

jest.mock("./aml-identity-repository", () => ({
  AmlIdentityRepository: jest.fn().mockImplementation(() => ({
    findByOrganization: (...args: unknown[]) => mockFindByOrganization(...args),
    upsertMapping: (...args: unknown[]) => mockUpsertMapping(...args),
  })),
}));

const mockFetchIndividualDirectorAMLStatuses = jest.fn(() => Promise.resolve([]));
const mockFetchIndividualShareholderAMLStatuses = jest.fn(() => Promise.resolve([]));
const mockFetchBusinessShareholderAMLStatuses = jest.fn(() => Promise.resolve([]));

jest.mock("./aml-fetcher", () => ({
  AMLFetcherService: jest.fn().mockImplementation(() => ({
    fetchIndividualDirectorAMLStatuses: (...args: unknown[]) => mockFetchIndividualDirectorAMLStatuses(...args),
    fetchIndividualShareholderAMLStatuses: (...args: unknown[]) => mockFetchIndividualShareholderAMLStatuses(...args),
    fetchBusinessShareholderAMLStatuses: (...args: unknown[]) => mockFetchBusinessShareholderAMLStatuses(...args),
  })),
}));

const mockGetCorporateOnboardingDetails = jest.fn(() => Promise.resolve({}));

jest.mock("./api-client", () => ({
  getRegTankAPIClient: () => ({
    getCorporateOnboardingDetails: (...args: unknown[]) => mockGetCorporateOnboardingDetails(...args),
    queryKYCStatus: jest.fn(),
    queryKYBStatus: jest.fn(),
  }),
}));

const mockApplyCorporateAmlMilestoneFromLiveKyb = jest.fn();
const mockApplyPersonalAmlMilestoneFromLiveKyc = jest.fn();

jest.mock("./webhooks/org-aml-milestone", () => ({
  applyCorporateAmlMilestoneFromLiveKyb: (...args: unknown[]) =>
    mockApplyCorporateAmlMilestoneFromLiveKyb(...args),
  applyPersonalAmlMilestoneFromLiveKyc: (...args: unknown[]) =>
    mockApplyPersonalAmlMilestoneFromLiveKyc(...args),
}));

const mockRegTankOnboardingFindFirst = jest.fn();
const mockInvestorOrgUpdate = jest.fn(() => Promise.resolve({}));
const mockIssuerOrgUpdate = jest.fn(() => Promise.resolve({}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    regTankOnboarding: {
      findFirst: (...args: unknown[]) => mockRegTankOnboardingFindFirst(...args),
    },
    investorOrganization: {
      update: (...args: unknown[]) => mockInvestorOrgUpdate(...args),
    },
    issuerOrganization: {
      update: (...args: unknown[]) => mockIssuerOrgUpdate(...args),
    },
  },
}));

import { AMLSyncService } from "./aml-sync-service";

describe("AMLSyncService.syncOrganizationAMLStatus — personal organizations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves the individual KYC record (not COD) and advances on Approved", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-1",
      type: OrganizationType.PERSONAL,
      name: "Jane Doe",
      kyc_id: "KYC001",
      onboarding_status: OnboardingStatus.PENDING_AML,
    });
    mockApplyPersonalAmlMilestoneFromLiveKyc.mockResolvedValue({
      approved: true,
      amlApproved: true,
      onboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
      advanced: true,
    });

    const service = new AMLSyncService();
    const result = await service.syncOrganizationAMLStatus("org-1", "investor", "user-1");

    expect(mockApplyPersonalAmlMilestoneFromLiveKyc).toHaveBeenCalledWith(
      expect.objectContaining({ kycId: "KYC001", organizationId: "org-1", portalType: "investor" })
    );
    expect(mockApplyPersonalAmlMilestoneFromLiveKyc.mock.calls[0]?.[0]).not.toHaveProperty(
      "onboardingId"
    );
    // Never routes personal orgs through the COD/corporate lookup.
    expect(mockRegTankOnboardingFindFirst).not.toHaveBeenCalled();
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_FINAL_APPROVAL);
    expect(result.advanced).toBe(true);
  });

  it("returns a clear typed error when no individual KYC record exists, not the COD error", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-1",
      type: OrganizationType.PERSONAL,
      name: "Jane Doe",
      kyc_id: null,
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
    });

    const service = new AMLSyncService();

    await expect(service.syncOrganizationAMLStatus("org-1", "investor", "user-1")).rejects.toMatchObject({
      code: "NO_APPLICABLE_REGTANK_RECORD",
    });
    expect(mockApplyPersonalAmlMilestoneFromLiveKyc).not.toHaveBeenCalled();
  });
});

describe("AMLSyncService.syncOrganizationAMLStatus — company organizations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("advances the organization when the main-company KYB milestone reports approved", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-2",
      type: OrganizationType.COMPANY,
      name: "Acme Sdn Bhd",
      onboarding_status: OnboardingStatus.PENDING_AML,
    });
    mockRegTankOnboardingFindFirst.mockResolvedValue({ request_id: "COD001" });
    mockGetCorporateOnboardingDetails.mockResolvedValue({});
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: true,
      amlApproved: true,
      onboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
      advanced: true,
    });

    const service = new AMLSyncService();
    const result = await service.syncOrganizationAMLStatus("org-2", "investor", "user-1");

    expect(mockApplyCorporateAmlMilestoneFromLiveKyb).toHaveBeenCalledWith(
      expect.objectContaining({ codRequestId: "COD001", organizationId: "org-2" })
    );
    expect(mockApplyCorporateAmlMilestoneFromLiveKyb.mock.calls[0]?.[0]).not.toHaveProperty(
      "onboardingId"
    );
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_FINAL_APPROVAL);
    expect(result.advanced).toBe(true);
  });

  it("does not report advancement when director rows are approved but the main KYB milestone is still pending", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-2",
      type: OrganizationType.COMPANY,
      name: "Acme Sdn Bhd",
      onboarding_status: OnboardingStatus.PENDING_AML,
    });
    mockRegTankOnboardingFindFirst.mockResolvedValue({ request_id: "COD001" });
    mockGetCorporateOnboardingDetails.mockResolvedValue({});
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AMLSyncService();
    const result = await service.syncOrganizationAMLStatus("org-2", "investor", "user-1");

    expect(result.advanced).toBe(false);
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_AML);
  });

  it("throws a clear typed error when no COD record exists for a company organization", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-2",
      type: OrganizationType.COMPANY,
      name: "Acme Sdn Bhd",
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
    });
    mockRegTankOnboardingFindFirst.mockResolvedValue(null);

    const service = new AMLSyncService();

    await expect(service.syncOrganizationAMLStatus("org-2", "investor", "user-1")).rejects.toMatchObject({
      code: "NO_APPLICABLE_REGTANK_RECORD",
    });
    expect(mockApplyCorporateAmlMilestoneFromLiveKyb).not.toHaveBeenCalled();
  });
});
