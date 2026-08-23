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

let updateChain = Promise.resolve();

function matchesAmlClaimWhere(row: Record<string, unknown> | null, where: Record<string, unknown>): boolean {
  if (!row) return false;
  if (where.aml_approved === false && row.aml_approved !== false) return false;
  const statusClause = where.onboarding_status as { notIn?: string[] } | undefined;
  if (statusClause?.notIn?.includes(row.onboarding_status as string)) return false;
  return true;
}

function serializedUpdateMany(
  getRow: () => Record<string, unknown> | null,
  setRow: (next: Record<string, unknown>) => void
) {
  return ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const run = async () => {
      const rest = { ...where };
      delete rest.id;
      if (!matchesAmlClaimWhere(getRow(), rest)) return { count: 0 };
      setRow({ ...(getRow() as Record<string, unknown>), ...data });
      return { count: 1 };
    };
    const next = updateChain.then(run, run);
    updateChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
}

const mockInvestorUpdateMany = jest.fn(
  serializedUpdateMany(
    () => investorOrg,
    (next) => {
      investorOrg = next;
    }
  )
);
const mockIssuerUpdateMany = jest.fn(
  serializedUpdateMany(
    () => issuerOrg,
    (next) => {
      issuerOrg = next;
    }
  )
);

const prismaClient = {
  investorOrganization: {
    findUnique: (...args: unknown[]) => mockInvestorFindUnique(...(args as [])),
    update: (...args: unknown[]) => mockInvestorUpdate(...(args as [{ data: Record<string, unknown> }])),
    updateMany: (...args: unknown[]) =>
      mockInvestorUpdateMany(...(args as [{ where: Record<string, unknown>; data: Record<string, unknown> }])),
  },
  issuerOrganization: {
    findUnique: (...args: unknown[]) => mockIssuerFindUnique(...(args as [])),
    update: (...args: unknown[]) => mockIssuerUpdate(...(args as [{ data: Record<string, unknown> }])),
    updateMany: (...args: unknown[]) =>
      mockIssuerUpdateMany(...(args as [{ where: Record<string, unknown>; data: Record<string, unknown> }])),
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
  updateChain = Promise.resolve();
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
      data?: { event_type?: string; onboarding_id?: string | null };
    };
    expect(payload.data?.event_type).toBe("AML_APPROVED");
    expect(payload.data?.onboarding_id ?? null).toBeNull();
  });

  it("links AML_APPROVED to reg_tank_onboarding.id when the caller supplies it", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });

    await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      trigger: "REGTANK_KYB_MAIN_COMPANY_APPROVED",
      onboardingId: "cmsw5yz970051r9vqk5h16dme",
      extraMetadata: { kybRequestId: "KYB00103", onboardingRequestId: "COD05463" },
    });

    expect(mockOnboardingAuditCreate).toHaveBeenCalledTimes(1);
    const payload = mockOnboardingAuditCreate.mock.calls[0]?.[0] as {
      data?: {
        event_type?: string;
        onboarding_id?: string | null;
        metadata?: Record<string, unknown>;
      };
    };
    expect(payload.data?.event_type).toBe("AML_APPROVED");
    expect(payload.data?.onboarding_id).toBe("cmsw5yz970051r9vqk5h16dme");
    expect(payload.data?.metadata).toEqual(
      expect.objectContaining({
        provider: "REGTANK",
        screeningKind: "KYB",
        providerReference: "KYB00103",
        previousApproved: false,
        newApproved: true,
        previousStatus: OnboardingStatus.PENDING_AML,
        newStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
        trigger: "REGTANK_KYB_MAIN_COMPANY_APPROVED",
      })
    );
    expect(payload.data?.metadata).not.toEqual(
      expect.objectContaining({ event_type: "ONBOARDING_STATUS_CHANGED" })
    );
    const eventTypes = mockOnboardingAuditCreate.mock.calls.map(
      (call) => (call[0] as { data?: { event_type?: string } }).data?.event_type
    );
    expect(eventTypes).toEqual(["AML_APPROVED"]);
  });

  it("issuer company KYB milestone writes AML_APPROVED with the supplied onboarding id", async () => {
    issuerOrg = {
      onboarding_status: OnboardingStatus.PENDING_AML,
      aml_approved: false,
      onboarding_approved: true,
      ssm_checked: true,
      type: OrganizationType.COMPANY,
      name: "Issuer Co",
      owner_user_id: "user-1",
    };

    await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-issuer-1",
      portalType: "issuer",
      userId: "user-1",
      trigger: "REGTANK_KYB_MAIN_COMPANY_APPROVED",
      onboardingId: "issuer-onboarding-1",
      extraMetadata: { kybRequestId: "KYB00103" },
    });

    expect(mockOnboardingAuditCreate).toHaveBeenCalledTimes(1);
    const payload = mockOnboardingAuditCreate.mock.calls[0]?.[0] as {
      data?: { event_type?: string; onboarding_id?: string | null; metadata?: Record<string, unknown> };
    };
    expect(payload.data?.event_type).toBe("AML_APPROVED");
    expect(payload.data?.onboarding_id).toBe("issuer-onboarding-1");
    expect(payload.data?.metadata).toEqual(
      expect.objectContaining({
        providerReference: "KYB00103",
        trigger: "REGTANK_KYB_MAIN_COMPANY_APPROVED",
        previousApproved: false,
        newApproved: true,
        previousStatus: OnboardingStatus.PENDING_AML,
        newStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
      })
    );
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

  it("duplicate AML approval writes exactly one AML_APPROVED", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });

    await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      trigger: "TEST",
    });
    await maybeAdvanceOrgAfterAmlScreeningCleared({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      trigger: "TEST",
    });

    expect(investorOrg?.aml_approved).toBe(true);
    expect(mockOnboardingAuditCreate).toHaveBeenCalledTimes(1);
  });

  it("concurrent AML approval writes exactly one AML_APPROVED", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });

    await Promise.all([
      maybeAdvanceOrgAfterAmlScreeningCleared({
        organizationId: "org-1",
        portalType: "investor",
        userId: "user-1",
        trigger: "TEST",
      }),
      maybeAdvanceOrgAfterAmlScreeningCleared({
        organizationId: "org-1",
        portalType: "investor",
        userId: "user-1",
        trigger: "TEST",
      }),
    ]);

    expect(investorOrg?.aml_approved).toBe(true);
    expect(mockOnboardingAuditCreate).toHaveBeenCalledTimes(1);
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

  it("threads a caller-supplied onboarding id onto AML_APPROVED without looking it up", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });
    mockGetCorporateOnboardingDetails.mockResolvedValue({ kybRequestDto: { kybId: "KYB001" } });
    mockQueryKYBStatus.mockResolvedValue({ status: "Approved" });

    await applyCorporateAmlMilestoneFromLiveKyb({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      codRequestId: "COD001",
      trigger: "ADMIN_MANUAL_AML_REFRESH",
      onboardingId: "onboarding-1",
    });

    expect(mockOnboardingAuditCreate).toHaveBeenCalledTimes(1);
    const payload = mockOnboardingAuditCreate.mock.calls[0]?.[0] as {
      data?: { event_type?: string; onboarding_id?: string | null };
    };
    expect(payload.data?.event_type).toBe("AML_APPROVED");
    expect(payload.data?.onboarding_id).toBe("onboarding-1");
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

  it("threads a caller-supplied onboarding id onto personal AML_APPROVED", async () => {
    resetOrg({ onboarding_status: OnboardingStatus.PENDING_AML });
    mockQueryKYCStatus.mockResolvedValue({ status: "Approved" });

    await applyPersonalAmlMilestoneFromLiveKyc({
      organizationId: "org-1",
      portalType: "investor",
      userId: "user-1",
      kycId: "KYC001",
      trigger: "ADMIN_MANUAL_ONBOARDING_REFRESH_PERSONAL",
      onboardingId: "personal-onboarding-1",
    });

    expect(mockOnboardingAuditCreate).toHaveBeenCalledTimes(1);
    const payload = mockOnboardingAuditCreate.mock.calls[0]?.[0] as {
      data?: { event_type?: string; onboarding_id?: string | null; metadata?: Record<string, unknown> };
    };
    expect(payload.data?.event_type).toBe("AML_APPROVED");
    expect(payload.data?.onboarding_id).toBe("personal-onboarding-1");
    expect(payload.data?.metadata).toEqual(
      expect.objectContaining({
        screeningKind: "KYC",
        trigger: "ADMIN_MANUAL_ONBOARDING_REFRESH_PERSONAL",
        previousApproved: false,
        newApproved: true,
      })
    );
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
