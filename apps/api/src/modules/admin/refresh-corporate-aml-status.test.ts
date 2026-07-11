import { OnboardingStatus } from "@prisma/client";

// Trivial stubs — refreshCorporateAmlStatus does not use any of these instance deps.
jest.mock("./repository", () => ({ AdminRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/repository", () => ({ RegTankRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/api-client", () => ({ RegTankAPIClient: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/service", () => ({ RegTankService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../organization/repository", () => ({ OrganizationRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../notification/service", () => ({ NotificationService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../products/repository", () => ({ ProductRepository: jest.fn().mockImplementation(() => ({})) }));

const mockFetchAllAMLStatuses = jest.fn(() => Promise.resolve());
jest.mock("../regtank/aml-fetcher", () => ({
  AMLFetcherService: jest.fn().mockImplementation(() => ({
    fetchAllAMLStatuses: (...args: unknown[]) => mockFetchAllAMLStatuses(...args),
  })),
}));

const mockApplyCorporateAmlMilestoneFromLiveKyb = jest.fn();
jest.mock("../regtank/webhooks/org-aml-milestone", () => ({
  applyCorporateAmlMilestoneFromLiveKyb: (...args: unknown[]) =>
    mockApplyCorporateAmlMilestoneFromLiveKyb(...args),
}));

const mockRegTankOnboardingFindUnique = jest.fn();
const mockInvestorOrgFindUnique = jest.fn(() => Promise.resolve({ director_aml_status: { directors: [] } }));
const mockIssuerOrgFindUnique = jest.fn(() => Promise.resolve({ director_aml_status: { directors: [] } }));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    regTankOnboarding: {
      findUnique: (...args: unknown[]) => mockRegTankOnboardingFindUnique(...args),
    },
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorOrgFindUnique(...args),
    },
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerOrgFindUnique(...args),
    },
  },
}));

import { AdminService } from "./service";

function baseOnboarding() {
  return {
    id: "onboarding-1",
    request_id: "COD001",
    onboarding_type: "CORPORATE",
    portal_type: "investor",
    investor_organization: { id: "org-1", name: "Acme Sdn Bhd", onboarding_status: OnboardingStatus.PENDING_AML },
    issuer_organization: null,
    user: { user_id: "u1", email: "a@b.com", first_name: "A", last_name: "B" },
  };
}

describe("AdminService.refreshCorporateAmlStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("advances the organization and reports it when RegTank confirms approval", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(baseOnboarding());
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: true,
      amlApproved: true,
      onboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
      advanced: true,
    });

    const service = new AdminService();
    const result = await service.refreshCorporateAmlStatus({} as never, "onboarding-1", "admin-1");

    expect(mockFetchAllAMLStatuses).toHaveBeenCalledWith("COD001", "org-1", "investor");
    expect(mockApplyCorporateAmlMilestoneFromLiveKyb).toHaveBeenCalledWith(
      expect.objectContaining({ codRequestId: "COD001", organizationId: "org-1", userId: "admin-1" })
    );
    expect(result.advanced).toBe(true);
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_FINAL_APPROVAL);
    expect(result.amlApproved).toBe(true);
  });

  it("reports RegTank pending without advancing the organization", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(baseOnboarding());
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AdminService();
    const result = await service.refreshCorporateAmlStatus({} as never, "onboarding-1", "admin-1");

    expect(result.advanced).toBe(false);
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_AML);
  });

  it("treats an undocumented/unknown live status as not-approved (no advance)", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(baseOnboarding());
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AdminService();
    const result = await service.refreshCorporateAmlStatus({} as never, "onboarding-1", "admin-1");

    expect(result.advanced).toBe(false);
  });

  it("is idempotent across repeated approved refreshes", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(baseOnboarding());
    mockApplyCorporateAmlMilestoneFromLiveKyb
      .mockResolvedValueOnce({
        approved: true,
        amlApproved: true,
        onboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
        advanced: true,
      })
      .mockResolvedValueOnce({
        approved: true,
        amlApproved: true,
        onboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
        advanced: false,
      });

    const service = new AdminService();
    const first = await service.refreshCorporateAmlStatus({} as never, "onboarding-1", "admin-1");
    const second = await service.refreshCorporateAmlStatus({} as never, "onboarding-1", "admin-1");

    expect(first.advanced).toBe(true);
    expect(second.advanced).toBe(false);
    expect(second.onboardingStatus).toBe(OnboardingStatus.PENDING_FINAL_APPROVAL);
  });
});
