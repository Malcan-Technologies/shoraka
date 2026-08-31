import { OnboardingStatus } from "@prisma/client";

// Trivial stubs for constructor deps not exercised by these tests.
jest.mock("./repository", () => ({ AdminRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../notification/service", () => ({ NotificationService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../products/repository", () => ({ ProductRepository: jest.fn().mockImplementation(() => ({})) }));

const mockQueryOnboardingDetails = jest.fn();
const mockGetCorporateOnboardingDetails = jest.fn();
const mockGetEntityOnboardingDetails = jest.fn();
const mockQueryKYCStatus = jest.fn();
const mockQueryKYBStatus = jest.fn();
jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({
    queryOnboardingDetails: (...args: unknown[]) => mockQueryOnboardingDetails(...args),
    getCorporateOnboardingDetails: (...args: unknown[]) => mockGetCorporateOnboardingDetails(...args),
    getEntityOnboardingDetails: (...args: unknown[]) => mockGetEntityOnboardingDetails(...args),
    queryKYCStatus: (...args: unknown[]) => mockQueryKYCStatus(...args),
    queryKYBStatus: (...args: unknown[]) => mockQueryKYBStatus(...args),
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

const mockAdvanceOnboardingStatusFromFlags = jest.fn();
jest.mock("../onboarding/utils/advance-onboarding-status", () => ({
  advanceOnboardingStatusFromFlags: (...args: unknown[]) =>
    mockAdvanceOnboardingStatusFromFlags(...args),
}));

const mockRegTankOnboardingFindUnique = jest.fn();
const mockInvestorOrgFindUnique = jest.fn();
const mockIssuerOrgFindUnique = jest.fn();
const mockInvestorOrgUpdate = jest.fn(() => Promise.resolve());
const mockIssuerOrgUpdate = jest.fn(() => Promise.resolve());
const mockOnboardingLogCreate = jest.fn(() => Promise.resolve());
jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
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
      })
    ),
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

const adminReq = { headers: {}, ip: undefined } as never;

function personalOnboarding(overrides: Record<string, unknown> = {}) {
  return {
    id: "onboarding-1",
    request_id: "LD001",
    reference_id: "ref-1",
    user_id: "user-1",
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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-1", "admin-1");

    expect(mockHandleWebhookUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "LD001", status: "APPROVED" }),
      expect.objectContaining({ portal: "ADMIN", actorUserId: "admin-1" })
    );
    expect(mockApplyPersonalAmlMilestoneFromLiveKyc).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        kycId: "KYC001",
        userId: "user-1",
        actorUserId: "admin-1",
      })
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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-1", "admin-1");

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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-1", "admin-1");

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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-1", "admin-1");

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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-1", "admin-1");

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
    await service.refreshOnboardingStatus(adminReq, "onboarding-1", "admin-1");

    expect(mockHandleWebhookUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "LD001", status: "APPROVED", referenceId: "ref-1" }),
      expect.objectContaining({ portal: "ADMIN", actorUserId: "admin-1" })
    );
  });
});

describe("AdminService.refreshOnboardingStatus — company", () => {
  beforeEach(() => jest.clearAllMocks());

  it("persists COD04000 directors/shareholders into corporate_entities during refresh", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(corporateOnboarding({ request_id: "COD04000" }));
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      status: "WAIT_FOR_APPROVAL",
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD04651", status: "APPROVED" },
          corporateUserRequestInfo: {
            firstName: "Lucas",
            lastName: "Yi Jin",
            fullName: "Lucas Yi Jin",
            email: "lucas@example.com",
            formContent: {
              content: [
                { fieldName: "First Name", fieldValue: "Lucas" },
                { fieldName: "Last Name", fieldValue: "Yi Jin" },
                { fieldName: "Designation", fieldValue: "Director" },
                { fieldName: "Email Address", fieldValue: "lucas@example.com" },
                { fieldName: "Government ID Number", fieldValue: "900101-10-1111" },
              ],
            },
          },
          kycRequestInfo: { kycId: "KY-COD04000" },
        },
      ],
      corpIndvShareholders: [
        {
          corporateIndividualRequest: { requestId: "EOD04650", status: "APPROVED" },
          corporateUserRequestInfo: {
            firstName: "Lucas",
            lastName: "Yi Jin",
            fullName: "Lucas Yi Jin",
            email: "lucas@example.com",
            formContent: {
              content: [
                { fieldName: "First Name", fieldValue: "Lucas" },
                { fieldName: "Last Name", fieldValue: "Yi Jin" },
                { fieldName: "Email Address", fieldValue: "lucas@example.com" },
                { fieldName: "% of Shares", fieldValue: "60" },
                { fieldName: "Government ID Number", fieldValue: "900101-10-1111" },
              ],
            },
          },
          kycRequestInfo: { kycId: "KY-COD04000-SH" },
        },
      ],
      corpBizShareholders: [],
    });
    mockInvestorOrgFindUnique.mockResolvedValue({
      corporate_entities: null,
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
    await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    const investorUpdatePayload = mockInvestorOrgUpdate.mock.calls.find(
      (call) => call?.[0]?.where?.id === "org-2" && call?.[0]?.data?.director_kyc_status
    )?.[0];
    expect(investorUpdatePayload).toBeDefined();
    expect(investorUpdatePayload.data.corporate_entities.directors[0].eodRequestId).toBe("EOD04651");
    expect(investorUpdatePayload.data.corporate_entities.shareholders[0].eodRequestId).toBe("EOD04650");
    expect(
      investorUpdatePayload.data.corporate_entities.shareholders[0].personalInfo.formContent.content
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldName: "% of Shares", fieldValue: "60" })])
    );
  });

  it("refresh uses issuer organization when onboarding portal_type is issuer", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      corporateOnboarding({
        id: "onboarding-issuer",
        portal_type: "issuer",
        issuer_organization: {
          id: "issuer-org-1",
          name: "Issuer Co",
          onboarding_status: OnboardingStatus.PENDING_AML,
          onboarding_approved: true,
          aml_approved: false,
          ssm_checked: true,
        },
        investor_organization: null,
      })
    );
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      status: "WAIT_FOR_APPROVAL",
      corpIndvDirectors: [],
      corpIndvShareholders: [],
      corpBizShareholders: [],
    });
    mockIssuerOrgFindUnique.mockResolvedValue({
      corporate_entities: null,
      director_aml_status: { directors: [] },
      ssm_checked: true,
    });
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AdminService();
    await service.refreshOnboardingStatus(adminReq, "onboarding-issuer", "admin-1");

    expect(mockIssuerOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "issuer-org-1" } })
    );
    expect(mockInvestorOrgUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "issuer-org-1" } })
    );
  });

  it("does not duplicate shareholder role text when COD contains repeated shareholder rows", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(corporateOnboarding({ request_id: "COD04000" }));
    const shareholder = {
      corporateIndividualRequest: { requestId: "EOD04650", status: "APPROVED" },
      corporateUserRequestInfo: {
        firstName: "Lucas",
        lastName: "Yi Jin",
        fullName: "Lucas Yi Jin",
        email: "lucas@example.com",
        formContent: {
          content: [
            { fieldName: "First Name", fieldValue: "Lucas" },
            { fieldName: "Last Name", fieldValue: "Yi Jin" },
            { fieldName: "Email Address", fieldValue: "lucas@example.com" },
            { fieldName: "% of Shares", fieldValue: "60" },
          ],
        },
      },
      kycRequestInfo: { kycId: "KY-COD04000-SH" },
    };
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      status: "WAIT_FOR_APPROVAL",
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD04651", status: "APPROVED" },
          corporateUserRequestInfo: {
            firstName: "Lucas",
            lastName: "Yi Jin",
            fullName: "Lucas Yi Jin",
            email: "lucas@example.com",
            formContent: {
              content: [
                { fieldName: "First Name", fieldValue: "Lucas" },
                { fieldName: "Last Name", fieldValue: "Yi Jin" },
                { fieldName: "Designation", fieldValue: "Director" },
                { fieldName: "Email Address", fieldValue: "lucas@example.com" },
              ],
            },
          },
          kycRequestInfo: { kycId: "KY-COD04000" },
        },
      ],
      corpIndvShareholders: [shareholder, shareholder],
      corpBizShareholders: [],
    });
    mockInvestorOrgFindUnique.mockResolvedValue({
      corporate_entities: null,
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
    await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    const investorUpdatePayload = mockInvestorOrgUpdate.mock.calls.find(
      (call) => call?.[0]?.where?.id === "org-2" && call?.[0]?.data?.director_kyc_status
    )?.[0];
    const mergedRole = investorUpdatePayload?.data?.director_kyc_status?.directors?.[0]?.role;
    expect(mergedRole).toBe("Director, Shareholder (60%)");
  });

  it("persists live EXPIRED COD status to the exact selected request_id row", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      corporateOnboarding({
        request_id: "COD05339",
        investor_organization: {
          id: "org-2",
          name: "Acme Sdn Bhd",
          onboarding_status: OnboardingStatus.PENDING_AML,
          onboarding_approved: true,
          aml_approved: false,
          ssm_approved: true,
        },
      })
    );
    mockGetCorporateOnboardingDetails.mockResolvedValue({ status: "EXPIRED", corpIndvDirectors: [] });
    mockInvestorOrgFindUnique.mockResolvedValue({ director_aml_status: { directors: [] }, ssm_approved: true });
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD05339",
      expect.objectContaining({
        status: "EXPIRED",
        regtankResponse: expect.objectContaining({ status: "EXPIRED" }),
      })
    );
    expect(result.onboardingProviderStatus).toBe("EXPIRED");
  });

  it("persists live active COD status to the exact selected request_id row", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(corporateOnboarding({ request_id: "COD001" }));
    mockGetCorporateOnboardingDetails.mockResolvedValue({ status: "WAIT_FOR_APPROVAL", corpIndvDirectors: [] });
    mockInvestorOrgFindUnique.mockResolvedValue({ director_aml_status: { directors: [] }, ssm_approved: true });
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AdminService();
    await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD001",
      expect.objectContaining({
        status: "WAIT_FOR_APPROVAL",
        regtankResponse: expect.objectContaining({ status: "WAIT_FOR_APPROVAL" }),
      })
    );
  });

  it("never updates another COD row while persisting corporate status", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(corporateOnboarding({ request_id: "COD05339" }));
    mockGetCorporateOnboardingDetails.mockResolvedValue({ status: "PROCESSING", corpIndvDirectors: [] });
    mockInvestorOrgFindUnique.mockResolvedValue({ director_aml_status: { directors: [] }, ssm_approved: true });
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AdminService();
    await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD05339",
      expect.objectContaining({ status: "PROCESSING" })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith("COD00001", expect.anything());
  });

  it("keeps existing corporate APPROVED progression behavior", async () => {
    mockAdvanceOnboardingStatusFromFlags.mockResolvedValue({ changed: true });
    mockRegTankOnboardingFindUnique.mockResolvedValue(
      corporateOnboarding({
        request_id: "COD05339",
        investor_organization: {
          id: "org-2",
          name: "Acme Sdn Bhd",
          onboarding_status: OnboardingStatus.PENDING_APPROVAL,
          onboarding_approved: false,
          aml_approved: false,
          ssm_approved: true,
        },
      })
    );
    mockGetCorporateOnboardingDetails.mockResolvedValue({ status: "APPROVED", corpIndvDirectors: [] });
    mockInvestorOrgFindUnique.mockResolvedValue({
      onboarding_status: OnboardingStatus.PENDING_AML,
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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    expect(mockAdvanceOnboardingStatusFromFlags).toHaveBeenCalled();
    expect(result.onboardingProviderStatus).toBe("APPROVED");
  });

  it("does not overwrite local corporate status when provider query fails", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(corporateOnboarding({ request_id: "COD05339" }));
    mockGetCorporateOnboardingDetails.mockRejectedValue(new Error("RegTank COD timeout"));
    mockInvestorOrgFindUnique.mockResolvedValue({ director_aml_status: { directors: [] }, ssm_approved: true });
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockResolvedValue({
      approved: false,
      amlApproved: false,
      onboardingStatus: OnboardingStatus.PENDING_AML,
      advanced: false,
    });

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    expect(mockUpdateStatus).not.toHaveBeenCalledWith("COD05339", expect.anything());
    expect(result.partialFailures).toContain("COD");
  });

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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

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
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    expect(result.ssmApproved).toBe(true);
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_AML);
  });

  it("reports partial failure when EOD/KYB refresh fails but preserves the COD result", async () => {
    mockRegTankOnboardingFindUnique.mockResolvedValue(corporateOnboarding());
    mockGetCorporateOnboardingDetails.mockResolvedValue({ status: "WAIT_FOR_APPROVAL", corpIndvDirectors: [] });
    mockInvestorOrgFindUnique.mockResolvedValue({ ssm_approved: true });
    mockApplyCorporateAmlMilestoneFromLiveKyb.mockRejectedValue(new Error("RegTank KYB timeout"));

    const service = new AdminService();
    const result = await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    expect(result.partialFailures).toContain("KYB");
    expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_AML);
  });

  it("COD05079: same email + different government IDs stay two people with merged roles; expired EODs; COD05080 retained", async () => {
    const sharedEmail = "shared@example.com";
    const personForm = (first: string, last: string, govId: string, extra: { fieldName: string; fieldValue: string }[] = []) => ({
      firstName: first,
      lastName: last,
      fullName: `${first} ${last}`,
      email: sharedEmail,
      formContent: {
        content: [
          { fieldName: "First Name", fieldValue: first },
          { fieldName: "Last Name", fieldValue: last },
          { fieldName: "Email Address", fieldValue: sharedEmail },
          { fieldName: "Government ID Number", fieldValue: govId },
          ...extra,
        ],
      },
    });

    mockRegTankOnboardingFindUnique.mockResolvedValue(
      corporateOnboarding({ request_id: "COD05079" })
    );
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      status: "WAIT_FOR_APPROVAL",
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD06284", status: "EXPIRED" },
          corporateUserRequestInfo: personForm("Lim", "Tze Yang", "900101-10-1111", [
            { fieldName: "Designation", fieldValue: "Director" },
          ]),
        },
        {
          corporateIndividualRequest: { requestId: "EOD06286", status: "EXPIRED" },
          corporateUserRequestInfo: personForm("Ahmad", "Shahril", "800202-10-2222", [
            { fieldName: "Designation", fieldValue: "Director" },
          ]),
        },
      ],
      corpIndvShareholders: [
        {
          corporateIndividualRequest: { requestId: "EOD06283", status: "EXPIRED" },
          corporateUserRequestInfo: personForm("Lim", "Tze Yang", "900101-10-1111", [
            { fieldName: "% of Shares", fieldValue: "30" },
          ]),
        },
        {
          corporateIndividualRequest: { requestId: "EOD06285", status: "EXPIRED" },
          corporateUserRequestInfo: personForm("Ahmad", "Shahril", "800202-10-2222", [
            { fieldName: "% of Shares", fieldValue: "30" },
          ]),
        },
      ],
      corpBizShareholders: [
        {
          name: "ABC Berhad",
          isPrimary: false,
          corporateOnboardingRequest: { requestId: "COD05080", status: "WAIT_FOR_APPROVAL" },
          formContent: {
            content: [{ fieldName: "% of Shares", fieldValue: "30" }],
          },
        },
      ],
    });
    mockGetEntityOnboardingDetails.mockImplementation(async (requestId: string) => ({
      corporateIndividualRequest: { requestId, status: "EXPIRED" },
    }));
    mockInvestorOrgFindUnique.mockResolvedValue({
      corporate_entities: null,
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
    const first = await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");
    expect(first.onboardingStatus).toBe(OnboardingStatus.PENDING_AML);

    expect(mockGetCorporateOnboardingDetails).toHaveBeenCalledWith("COD05079");
    expect(mockGetEntityOnboardingDetails.mock.calls.map((c) => c[0]).sort()).toEqual(
      expect.arrayContaining(["EOD06283", "EOD06284", "EOD06285", "EOD06286"])
    );
    expect(mockQueryKYCStatus).not.toHaveBeenCalled();
    expect(mockQueryOnboardingDetails).not.toHaveBeenCalled();

    const investorUpdatePayload = mockInvestorOrgUpdate.mock.calls.find(
      (call) => call?.[0]?.where?.id === "org-2" && call?.[0]?.data?.director_kyc_status
    )?.[0];
    expect(investorUpdatePayload).toBeDefined();

    const directors = investorUpdatePayload.data.director_kyc_status.directors as Array<{
      name: string;
      email: string;
      role: string;
      kycStatus: string;
      kycId?: string;
      eodRequestId: string;
      shareholderEodRequestId?: string;
      governmentIdNumber?: string;
    }>;
    expect(directors).toHaveLength(2);

    const lim = directors.find((d) => d.name === "Lim Tze Yang");
    const ahmad = directors.find((d) => d.name === "Ahmad Shahril");
    expect(lim).toBeDefined();
    expect(ahmad).toBeDefined();
    expect(lim!.email).toBe(sharedEmail);
    expect(ahmad!.email).toBe(sharedEmail);
    expect(lim!.governmentIdNumber).not.toBe(ahmad!.governmentIdNumber);
    expect(lim!.role).toContain("Director");
    expect(lim!.role).toContain("Shareholder");
    expect(lim!.role).toContain("30%");
    expect(ahmad!.role).toContain("Director");
    expect(ahmad!.role).toContain("Shareholder");
    expect(ahmad!.role).toContain("30%");
    expect([lim!.eodRequestId, lim!.shareholderEodRequestId].sort()).toEqual(["EOD06283", "EOD06284"]);
    expect([ahmad!.eodRequestId, ahmad!.shareholderEodRequestId].sort()).toEqual(["EOD06285", "EOD06286"]);
    expect(lim!.kycStatus).toBe("EXPIRED");
    expect(ahmad!.kycStatus).toBe("EXPIRED");
    expect(lim!.kycId).toBeUndefined();
    expect(ahmad!.kycId).toBeUndefined();

    const corpShareholders = investorUpdatePayload.data.corporate_entities.corporateShareholders;
    expect(corpShareholders).toHaveLength(1);
    expect(corpShareholders[0].name).toBe("ABC Berhad");
    expect(corpShareholders[0].corporateOnboardingRequest.requestId).toBe("COD05080");
    expect(corpShareholders[0].corporateOnboardingRequest.status).toBe("WAIT_FOR_APPROVAL");
    expect(corpShareholders[0].isPrimary).toBe(false);

    // Idempotent second refresh
    mockInvestorOrgFindUnique.mockResolvedValue({
      corporate_entities: investorUpdatePayload.data.corporate_entities,
      director_aml_status: { directors: [] },
      ssm_approved: true,
    });
    mockInvestorOrgUpdate.mockClear();
    mockGetCorporateOnboardingDetails.mockClear();
    mockGetEntityOnboardingDetails.mockClear();

    await service.refreshOnboardingStatus(adminReq, "onboarding-2", "admin-1");

    const secondUpdate = mockInvestorOrgUpdate.mock.calls.find(
      (call) => call?.[0]?.where?.id === "org-2" && call?.[0]?.data?.director_kyc_status
    )?.[0];
    expect(secondUpdate.data.director_kyc_status.directors).toHaveLength(2);
    expect(secondUpdate.data.corporate_entities.corporateShareholders).toHaveLength(1);
    expect(secondUpdate.data.corporate_entities.corporateShareholders[0].corporateOnboardingRequest.requestId).toBe(
      "COD05080"
    );
    expect(mockGetCorporateOnboardingDetails).toHaveBeenCalledWith("COD05079");
    expect(mockQueryKYCStatus).not.toHaveBeenCalled();
  });
});
