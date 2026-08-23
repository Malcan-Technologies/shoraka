import { OnboardingStatus } from "@prisma/client";
import {
  claimAmlApproved,
  claimLandPendingApproval,
  claimLandPendingSsmReview,
  claimOnboardingApproved,
  claimOnboardingRejected,
  claimSsmApproved,
  claimFinalApprovalCompleted,
} from "./onboarding-transition-claims";

type OrgRow = Record<string, unknown>;

function matchesWhere(row: OrgRow, where: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(where)) {
    const actual = row[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const clause = expected as Record<string, unknown>;
      if (Array.isArray(clause.in) && !clause.in.includes(actual)) return false;
      if (Array.isArray(clause.notIn) && clause.notIn.includes(actual)) return false;
      if ("not" in clause && actual === clause.not) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function createClaimDb(initial: OrgRow) {
  const row: { current: OrgRow } = { current: { ...initial } };
  let updateChain = Promise.resolve();

  const updateMany = ({
    where,
    data,
  }: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => {
    const run = async () => {
      const { id: _id, ...rest } = where;
      if (!matchesWhere(row.current, rest)) return { count: 0 };
      row.current = { ...row.current, ...data };
      return { count: 1 };
    };
    const next = updateChain.then(run, run);
    updateChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  const db = {
    investorOrganization: { updateMany },
    issuerOrganization: { updateMany },
  };

  return { db, row };
}

const baseOrg = {
  id: "org-1",
  onboarding_status: OnboardingStatus.PENDING,
  onboarding_approved: false,
  aml_approved: false,
  ssm_approved: false,
};

describe("onboarding transition claims", () => {
  it("lands PENDING_APPROVAL once; duplicate liveness/WFA is a no-op", async () => {
    const { db, row } = createClaimDb(baseOrg);
    const first = await claimLandPendingApproval({
      organizationId: "org-1",
      portalType: "investor",
      db: db as never,
    });
    const second = await claimLandPendingApproval({
      organizationId: "org-1",
      portalType: "investor",
      db: db as never,
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(row.current.onboarding_status).toBe(OnboardingStatus.PENDING_APPROVAL);
  });

  it("concurrent land-pending-approval claims succeed once", async () => {
    const { db, row } = createClaimDb({ ...baseOrg, onboarding_status: OnboardingStatus.IN_PROGRESS });
    const [a, b] = await Promise.all([
      claimLandPendingApproval({ organizationId: "org-1", portalType: "investor", db: db as never }),
      claimLandPendingApproval({ organizationId: "org-1", portalType: "investor", db: db as never }),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(row.current.onboarding_status).toBe(OnboardingStatus.PENDING_APPROVAL);
  });

  it("does not land PENDING_APPROVAL from later stages", async () => {
    const { db } = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_AML,
    });
    expect(
      await claimLandPendingApproval({
        organizationId: "org-1",
        portalType: "investor",
        db: db as never,
      })
    ).toBe(false);
  });

  it("ONBOARDING_APPROVED claim wins once from PENDING_APPROVAL", async () => {
    const { db, row } = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
    });
    expect(
      await claimOnboardingApproved({
        organizationId: "org-1",
        portalType: "investor",
        db: db as never,
      })
    ).toBe(true);
    expect(
      await claimOnboardingApproved({
        organizationId: "org-1",
        portalType: "investor",
        db: db as never,
      })
    ).toBe(false);
    expect(row.current.onboarding_approved).toBe(true);
  });

  it("concurrent ONBOARDING_APPROVED claims succeed once", async () => {
    const { db } = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
    });
    const results = await Promise.all([
      claimOnboardingApproved({ organizationId: "org-1", portalType: "investor", db: db as never }),
      claimOnboardingApproved({ organizationId: "org-1", portalType: "investor", db: db as never }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("AML_APPROVED claim wins once; sequential duplicate is no-op", async () => {
    const { db, row } = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_AML,
    });
    expect(
      await claimAmlApproved({ organizationId: "org-1", portalType: "investor", db: db as never })
    ).toBe(true);
    expect(
      await claimAmlApproved({ organizationId: "org-1", portalType: "investor", db: db as never })
    ).toBe(false);
    expect(row.current.aml_approved).toBe(true);
  });

  it("concurrent AML_APPROVED claims succeed once", async () => {
    const { db } = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_AML,
    });
    const results = await Promise.all([
      claimAmlApproved({ organizationId: "org-1", portalType: "investor", db: db as never }),
      claimAmlApproved({ organizationId: "org-1", portalType: "investor", db: db as never }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("does not claim AML on COMPLETED or REJECTED", async () => {
    for (const status of [OnboardingStatus.COMPLETED, OnboardingStatus.REJECTED]) {
      const { db } = createClaimDb({ ...baseOrg, onboarding_status: status });
      expect(
        await claimAmlApproved({ organizationId: "org-1", portalType: "investor", db: db as never })
      ).toBe(false);
    }
  });

  it("REJECTED claim wins once and does not overwrite COMPLETED", async () => {
    const pending = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
    });
    expect(
      await claimOnboardingRejected({
        organizationId: "org-1",
        portalType: "investor",
        db: pending.db as never,
      })
    ).toBe(true);
    expect(
      await claimOnboardingRejected({
        organizationId: "org-1",
        portalType: "investor",
        db: pending.db as never,
      })
    ).toBe(false);

    const completed = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.COMPLETED,
    });
    expect(
      await claimOnboardingRejected({
        organizationId: "org-1",
        portalType: "issuer",
        db: completed.db as never,
      })
    ).toBe(false);
    expect(completed.row.current.onboarding_status).toBe(OnboardingStatus.COMPLETED);
  });

  it("concurrent REJECTED claims succeed once", async () => {
    const { db, row } = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_AML,
    });
    const results = await Promise.all([
      claimOnboardingRejected({ organizationId: "org-1", portalType: "investor", db: db as never }),
      claimOnboardingRejected({ organizationId: "org-1", portalType: "investor", db: db as never }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(row.current.onboarding_status).toBe(OnboardingStatus.REJECTED);
  });

  it("SSM and final-approval claims require the expected prior status", async () => {
    const ssm = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW,
    });
    expect(
      await claimSsmApproved({ organizationId: "org-1", portalType: "investor", db: ssm.db as never })
    ).toBe(true);
    expect(
      await claimSsmApproved({ organizationId: "org-1", portalType: "investor", db: ssm.db as never })
    ).toBe(false);

    const final = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_FINAL_APPROVAL,
    });
    expect(
      await claimFinalApprovalCompleted({
        organizationId: "org-1",
        portalType: "issuer",
        db: final.db as never,
      })
    ).toBe(true);
    expect(
      await claimFinalApprovalCompleted({
        organizationId: "org-1",
        portalType: "issuer",
        db: final.db as never,
      })
    ).toBe(false);
  });

  it("company SSM landing does not regress later stages", async () => {
    const { db, row } = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
    });
    expect(
      await claimLandPendingSsmReview({
        organizationId: "org-1",
        portalType: "issuer",
        db: db as never,
      })
    ).toBe(false);
    expect(row.current.onboarding_status).toBe(OnboardingStatus.PENDING_APPROVAL);
  });

  it("concurrent SSM and final-approval claims succeed once", async () => {
    const ssm = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW,
    });
    const ssmResults = await Promise.all([
      claimSsmApproved({ organizationId: "org-1", portalType: "investor", db: ssm.db as never }),
      claimSsmApproved({ organizationId: "org-1", portalType: "investor", db: ssm.db as never }),
    ]);
    expect(ssmResults.filter(Boolean)).toHaveLength(1);
    expect(ssm.row.current.onboarding_status).toBe(OnboardingStatus.PENDING_APPROVAL);

    const final = createClaimDb({
      ...baseOrg,
      onboarding_status: OnboardingStatus.PENDING_FINAL_APPROVAL,
    });
    const finalResults = await Promise.all([
      claimFinalApprovalCompleted({
        organizationId: "org-1",
        portalType: "issuer",
        db: final.db as never,
      }),
      claimFinalApprovalCompleted({
        organizationId: "org-1",
        portalType: "issuer",
        db: final.db as never,
      }),
    ]);
    expect(finalResults.filter(Boolean)).toHaveLength(1);
    expect(final.row.current.onboarding_status).toBe(OnboardingStatus.COMPLETED);
  });
});
