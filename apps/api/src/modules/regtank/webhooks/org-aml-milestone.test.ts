import { OnboardingStatus, OrganizationType } from "@prisma/client";

/**
 * In-memory "database" so multi-step flows (milestone check -> advanceOnboardingStatusFromFlags
 * -> re-read) behave like a real record instead of a brittle fixed call-order mock chain.
 */
let investorOrg: Record<string, unknown> | null = null;
let issuerOrg: Record<string, unknown> | null = null;
const onboardingAuditCreates: unknown[] = [];

const mockInvestorFindUnique = jest.fn(() => Promise.resolve(investorOrg));
const mockInvestorUpdate = jest.fn(({ data }: { data: Record<string, unknown> }) => {
  investorOrg = { ...(investorOrg as Record<string, unknown>), ...data };
  return Promise.resolve(investorOrg);
});
const mockIssuerFindUnique = jest.fn(() => Promise.resolve(issuerOrg));
const mockIssuerUpdate = jest.fn(({ data }: { data: Record<string, unknown> }) => {
  issuerOrg = { ...(issuerOrg as Record<string, unknown>), ...data };
  return Promise.resolve(issuerOrg);
});
const mockOnboardingAuditCreate = jest.fn((args: unknown) => {
  onboardingAuditCreates.push(args);
  return Promise.resolve({});
});
const mockUserFindUnique = jest.fn(() =>
  Promise.resolve({ first_name: "Ada", last_name: "Admin", email: "ada@example.com" })
);
const mockRegTankOnboardingFindUnique = jest.fn(() => Promise.resolve(null));

const prismaClient = {
  investorOrganization: {
    findUnique: (...args: unknown[]) => mockInvestorFindUnique(...(args as [])),
    update: (...args: unknown[]) => mockInvestorUpdate(...(args as [{ data: Record<string, unknown> }])),
  },
  issuerOrganization: {
    findUnique: (...args: unknown[]) => mockIssuerFindUnique(...(args as [])),
    update: (...args: unknown[]) => mockIssuerUpdate(...(args as [{ data: Record<string, unknown> }])),
  },
  onboardingAuditLog: {
    create: (...args: unknown[]) => mockOnboardingAuditCreate(...(args as [unknown])),
  },
  user: {
    findUnique: (...args: unknown[]) => mockUserFindUnique(...(args as [])),
  },
  regTankOnboarding: {
    findUnique: (...args: unknown[]) => mockRegTankOnboardingFindUnique(...(args as [])),
  },
  $transaction: async (fn: (tx: typeof prismaClient) => Promise<unknown>) => fn(prismaClient),
};

jest.mock("../../../lib/prisma", () => ({
  prisma: prismaClient,
}));

const mockGetCorporateOnboardingDetails = jest.fn();
const mockQueryKYBStatus = jest.fn();
const mockQueryKYCStatus = jest.fn();

jest.mock("../api-client", () => ({
  getRegTankAPIClient: () => ({
    getCorporateOnboardingDetails: (...args: unknown[]) => mockGetCorporateOnboardingDetails(...args),
    queryKYBStatus: (...args: unknown[]) => mockQueryKYBStatus(...args),
    queryKYCStatus: (...args: unknown[]) => mockQueryKYCStatus(...args),
  }),
}));

import {
  applyCorporateAmlMilestoneFromLiveKyb,
  applyPersonalAmlMilestoneFromLiveKyc,
  maybeAdvanceOrgAfterAmlScreeningCleared,
} from "./org-aml-milestone";

function resetOrg(overrides: Partial<Record<string, unknown>> = {}) {
  investorOrg = {
    onboarding_status: OnboardingStatus.PENDING_AML,
    aml_approved: false,
    onboarding_approved: true,
    ssm_approved: true,
    type: OrganizationType.PERSONAL,
    name: "Test Org",
    owner_user_id: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  investorOrg = null;
  issuerOrg = null;
  onboardingAuditCreates.length = 0;
});

describe("maybeAdvanceOrgAfterAmlScreeningCleared", () => {
  it("sets aml_approved and advances PENDING_AML -> PENDING_FINAL_APPROVAL", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });

    const outcome = await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      trigger: "TEST",
    });

    expect(outcome.amlApproved).toBe(true);
    expect(outcome.onboardingStatus).toBe(OnboardingStatus.PENDING_FINAL_APPROVAL);
    expect(outcome.advanced).toBe(true);
    expect(mockOnboardingAuditCreate).toHaveBeenCalledTimes(1);
    const payload = mockOnboardingAuditCreate.mock.calls[0]?.[0] as {
      data?: { event_type?: string };
    };
    expect(payload.data?.event_type).toBe("AML_APPROVED");
  });

  it("D4: still records aml_approved even when org is not yet at PENDING_AML, without skipping earlier stages", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_APPROVAL, onboarding_approved: false });

    const outcome = await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      trigger: "TEST",
    });

    expect(outcome.amlApproved).toBe(true);
    // Onboarding approval itself hasn't happened yet, so status must NOT skip ahead.
    expect(outcome.onboardingStatus).toBe(OnboardingStatus.PENDING_APPROVAL);
    expect(outcome.advanced).toBe(false);
  });

  it("is idempotent when already PENDING_FINAL_APPROVAL with aml_approved", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_FINAL_APPROVAL, aml_approved: true });

    const outcome = await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      trigger: "TEST",
    });

    expect(outcome.advanced).toBe(false);
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
    expect(mockOnboardingAuditCreate).not.toHaveBeenCalled();
  });

  it("does not mutate organizations already in a terminal state (COMPLETED)", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.COMPLETED, aml_approved: false });

    const outcome = await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      trigger: "TEST",
    });

    expect(outcome.advanced).toBe(false);
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("does not mutate organizations already REJECTED", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.REJECTED, aml_approved: false });

    await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      trigger: "TEST",
    });

    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });
});

describe("applyCorporateAmlMilestoneFromLiveKyb", () => {
  it("advances the organization when the main-company KYB is exactly Approved", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });
    mockGetCorporateOnboardingDetails.mockResolvedValue({ kybRequestDto: { kybId: "KYB001" } });
    mockQueryKYBStatus.mockResolvedValue({ status: "Approved" });

    const outcome = await applyCorporateAmlMilestoneFromLiveKyb({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      codRequestId: "COD001",
      trigger: "TEST",
    });

    expect(outcome.approved).toBe(true);
    expect(outcome.advanced).toBe(true);
    expect(outcome.onboardingStatus).toBe(OnboardingStatus.PENDING_FINAL_APPROVAL);
  });

  it("does not advance when messageStatus is DONE but status is not Approved", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });
    mockGetCorporateOnboardingDetails.mockResolvedValue({ kybRequestDto: { kybId: "KYB001" } });
    mockQueryKYBStatus.mockResolvedValue({ status: "No Match", messageStatus: "DONE" });

    const outcome = await applyCorporateAmlMilestoneFromLiveKyb({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      codRequestId: "COD001",
      trigger: "TEST",
    });

    expect(outcome.approved).toBe(false);
    expect(outcome.advanced).toBe(false);
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("treats Risk Assessed as not approved (undocumented/partial statuses are never approval)", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });
    mockGetCorporateOnboardingDetails.mockResolvedValue({ kybRequestDto: { kybId: "KYB001" } });
    mockQueryKYBStatus.mockResolvedValue({ status: "Risk Assessed" });

    const outcome = await applyCorporateAmlMilestoneFromLiveKyb({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      codRequestId: "COD001",
      trigger: "TEST",
    });

    expect(outcome.approved).toBe(false);
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("is idempotent when called twice with an Approved result", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });
    mockGetCorporateOnboardingDetails.mockResolvedValue({ kybRequestDto: { kybId: "KYB001" } });
    mockQueryKYBStatus.mockResolvedValue({ status: "APPROVED" });

    const first = await applyCorporateAmlMilestoneFromLiveKyb({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      codRequestId: "COD001",
      trigger: "TEST",
    });
    const second = await applyCorporateAmlMilestoneFromLiveKyb({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      codRequestId: "COD001",
      trigger: "TEST",
    });

    expect(first.advanced).toBe(true);
    expect(second.advanced).toBe(false);
    expect(mockOnboardingAuditCreate).toHaveBeenCalledTimes(1);
  });
});

describe("applyPersonalAmlMilestoneFromLiveKyc", () => {
  it("advances a personal organization when individual KYC is exactly Approved", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });
    mockQueryKYCStatus.mockResolvedValue({ status: "Approved" });

    const outcome = await applyPersonalAmlMilestoneFromLiveKyc({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      kycId: "KYC001",
      trigger: "TEST",
    });

    expect(outcome.approved).toBe(true);
    expect(outcome.advanced).toBe(true);
    expect(outcome.onboardingStatus).toBe(OnboardingStatus.PENDING_FINAL_APPROVAL);
  });

  it("does not advance when KYC status is still pending", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });
    mockQueryKYCStatus.mockResolvedValue({ status: "Unresolved" });

    const outcome = await applyPersonalAmlMilestoneFromLiveKyc({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      kycId: "KYC001",
      trigger: "TEST",
    });

    expect(outcome.approved).toBe(false);
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });
});
