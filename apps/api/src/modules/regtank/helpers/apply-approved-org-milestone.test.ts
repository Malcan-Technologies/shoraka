import { OnboardingStatus, OrganizationType } from "@prisma/client";

let investorOrg: Record<string, unknown> | null = null;
let issuerOrg: Record<string, unknown> | null = null;
const onboardingAuditCreates: Array<{ data: { event_type: string } }> = [];

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(where)) {
    if (key === "id") continue;
    const actual = row[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const clause = expected as Record<string, unknown>;
      if (Array.isArray(clause.in) && !clause.in.includes(actual)) return false;
      if (Array.isArray(clause.notIn) && clause.notIn.includes(actual)) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

let updateChain = Promise.resolve();
function serializeUpdateMany(rowRef: { current: Record<string, unknown> | null }) {
  return ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const run = async () => {
      if (!rowRef.current || !matchesWhere(rowRef.current, where)) return { count: 0 };
      rowRef.current = { ...rowRef.current, ...data };
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

const investorRef = {
  get current() {
    return investorOrg;
  },
  set current(value: Record<string, unknown> | null) {
    investorOrg = value;
  },
};
const issuerRef = {
  get current() {
    return issuerOrg;
  },
  set current(value: Record<string, unknown> | null) {
    issuerOrg = value;
  },
};

const prismaClient = {
  investorOrganization: {
    findUnique: jest.fn(() => Promise.resolve(investorOrg)),
    updateMany: jest.fn((args: { where: Record<string, unknown>; data: Record<string, unknown> }) =>
      serializeUpdateMany(investorRef)(args)
    ),
  },
  issuerOrganization: {
    findUnique: jest.fn(() => Promise.resolve(issuerOrg)),
    updateMany: jest.fn((args: { where: Record<string, unknown>; data: Record<string, unknown> }) =>
      serializeUpdateMany(issuerRef)(args)
    ),
  },
  onboardingAuditLog: {
    create: jest.fn((args: { data: { event_type: string } }) => {
      onboardingAuditCreates.push(args);
      return Promise.resolve({});
    }),
  },
  user: {
    findUnique: jest.fn(() =>
      Promise.resolve({ first_name: "Ada", last_name: "Admin", email: "ada@example.com" })
    ),
  },
  $transaction: async (fn: (tx: typeof prismaClient) => Promise<unknown>) => fn(prismaClient),
};

jest.mock("../../../lib/prisma", () => ({
  prisma: prismaClient,
}));

jest.mock("../../onboarding/utils/advance-onboarding-status", () => ({
  advanceOnboardingStatusFromFlags: jest.fn(async () => {
    if (
      investorOrg?.onboarding_status === OnboardingStatus.PENDING_APPROVAL &&
      investorOrg.onboarding_approved
    ) {
      investorOrg = { ...investorOrg, onboarding_status: OnboardingStatus.PENDING_AML };
    }
    return { changed: true };
  }),
}));

import { applyApprovedOrganizationMilestone } from "./apply-approved-org-milestone";

function resetInvestor(overrides: Record<string, unknown> = {}) {
  investorOrg = {
    onboarding_status: OnboardingStatus.PENDING,
    onboarding_approved: false,
    type: OrganizationType.COMPANY,
    ...overrides,
  };
  issuerOrg = null;
  onboardingAuditCreates.length = 0;
  updateChain = Promise.resolve();
  jest.clearAllMocks();
}

function resetIssuer(overrides: Record<string, unknown> = {}) {
  issuerOrg = {
    onboarding_status: OnboardingStatus.PENDING,
    onboarding_approved: false,
    type: OrganizationType.COMPANY,
    ...overrides,
  };
  investorOrg = null;
  onboardingAuditCreates.length = 0;
  updateChain = Promise.resolve();
  jest.clearAllMocks();
}

const onboarding = { id: "ob-1", user_id: "user-1" };

describe("applyApprovedOrganizationMilestone", () => {
  it("investor company: first APPROVED lands PENDING_SSM_REVIEW with one STATUS_CHANGED", async () => {
    resetInvestor({ onboarding_status: OnboardingStatus.IN_PROGRESS });
    await applyApprovedOrganizationMilestone({
      organizationId: "org-1",
      portalType: "investor",
      onboarding,
    });
    expect(investorOrg?.onboarding_status).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
    expect(onboardingAuditCreates.filter((row) => row.data.event_type === "ONBOARDING_STATUS_CHANGED")).toHaveLength(
      1
    );
    expect(onboardingAuditCreates.filter((row) => row.data.event_type === "ONBOARDING_APPROVED")).toHaveLength(0);
  });

  it("investor company: duplicate APPROVED does not regress later stages or rewrite history", async () => {
    for (const status of [
      OnboardingStatus.PENDING_APPROVAL,
      OnboardingStatus.PENDING_AML,
      OnboardingStatus.PENDING_FINAL_APPROVAL,
      OnboardingStatus.COMPLETED,
    ]) {
      resetInvestor({
        onboarding_status: status,
        onboarding_approved: true,
        type: OrganizationType.COMPANY,
      });
      await applyApprovedOrganizationMilestone({
        organizationId: "org-1",
        portalType: "investor",
        onboarding,
      });
      expect(investorOrg?.onboarding_status).toBe(status);
      expect(onboardingAuditCreates).toHaveLength(0);
    }
  });

  it("issuer: late APPROVED does not regress later stages", async () => {
    for (const status of [
      OnboardingStatus.PENDING_APPROVAL,
      OnboardingStatus.PENDING_AML,
      OnboardingStatus.PENDING_FINAL_APPROVAL,
      OnboardingStatus.COMPLETED,
    ]) {
      resetIssuer({ onboarding_status: status, onboarding_approved: true });
      await applyApprovedOrganizationMilestone({
        organizationId: "org-1",
        portalType: "issuer",
        onboarding,
      });
      expect(issuerOrg?.onboarding_status).toBe(status);
      expect(onboardingAuditCreates).toHaveLength(0);
    }
  });

  it("issuer: valid earlier PENDING path advances to PENDING_SSM_REVIEW once", async () => {
    resetIssuer({ onboarding_status: OnboardingStatus.PENDING });
    await applyApprovedOrganizationMilestone({
      organizationId: "org-1",
      portalType: "issuer",
      onboarding,
    });
    await applyApprovedOrganizationMilestone({
      organizationId: "org-1",
      portalType: "issuer",
      onboarding,
    });
    expect(issuerOrg?.onboarding_status).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
    expect(onboardingAuditCreates.filter((row) => row.data.event_type === "ONBOARDING_STATUS_CHANGED")).toHaveLength(
      1
    );
  });

  it("personal investor: duplicate APPROVED writes exactly one ONBOARDING_APPROVED", async () => {
    resetInvestor({
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      onboarding_approved: false,
      type: OrganizationType.PERSONAL,
    });
    await applyApprovedOrganizationMilestone({
      organizationId: "org-1",
      portalType: "investor",
      onboarding,
    });
    await applyApprovedOrganizationMilestone({
      organizationId: "org-1",
      portalType: "investor",
      onboarding,
    });
    expect(onboardingAuditCreates.filter((row) => row.data.event_type === "ONBOARDING_APPROVED")).toHaveLength(1);
  });

  it("personal investor: concurrent APPROVED writes one ONBOARDING_APPROVED", async () => {
    resetInvestor({
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      onboarding_approved: false,
      type: OrganizationType.PERSONAL,
    });
    await Promise.all([
      applyApprovedOrganizationMilestone({
        organizationId: "org-1",
        portalType: "investor",
        onboarding,
      }),
      applyApprovedOrganizationMilestone({
        organizationId: "org-1",
        portalType: "investor",
        onboarding,
      }),
    ]);
    expect(onboardingAuditCreates.filter((row) => row.data.event_type === "ONBOARDING_APPROVED")).toHaveLength(1);
  });

  it("investor company: concurrent APPROVED lands PENDING_SSM_REVIEW once", async () => {
    resetInvestor({ onboarding_status: OnboardingStatus.IN_PROGRESS });
    await Promise.all([
      applyApprovedOrganizationMilestone({
        organizationId: "org-1",
        portalType: "investor",
        onboarding,
      }),
      applyApprovedOrganizationMilestone({
        organizationId: "org-1",
        portalType: "investor",
        onboarding,
      }),
    ]);
    expect(investorOrg?.onboarding_status).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
    expect(onboardingAuditCreates.filter((row) => row.data.event_type === "ONBOARDING_STATUS_CHANGED")).toHaveLength(
      1
    );
  });

  it("investor company: late APPROVED at PENDING_SSM_REVIEW is a no-op", async () => {
    resetInvestor({
      onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW,
      type: OrganizationType.COMPANY,
    });
    await applyApprovedOrganizationMilestone({
      organizationId: "org-1",
      portalType: "investor",
      onboarding,
    });
    expect(investorOrg?.onboarding_status).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
    expect(onboardingAuditCreates).toHaveLength(0);
  });
});
