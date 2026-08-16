import { OrganizationLogAdapter } from "./organization-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    onboardingAuditLog: { findMany: jest.fn(), count: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("../../../lib/prisma") as {
  prisma: {
    onboardingAuditLog: { findMany: jest.Mock; count: jest.Mock };
  };
};

function createRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "onb_1",
    event_type: "ONBOARDING_STARTED",
    subject_user_id: "user_1",
    organization_kind: "ISSUER",
    organization_type: "COMPANY",
    metadata: {},
    ip_address: null,
    user_agent: null,
    occurred_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("OrganizationLogAdapter visibility", () => {
  const adapter = new OrganizationLogAdapter();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hides final approval from user-facing activity", async () => {
    prisma.onboardingAuditLog.findMany.mockResolvedValue([
      createRecord({ id: "approved", event_type: "ONBOARDING_APPROVED" }),
      createRecord({ id: "final", event_type: "ONBOARDING_FINAL_APPROVAL_COMPLETED" }),
      createRecord({ id: "completed", event_type: "ONBOARDING_COMPLETED" }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.id)).toEqual(["approved", "completed"]);
  });

  it("shows director invitation and terminal KYC only when relevant", async () => {
    prisma.onboardingAuditLog.findMany.mockResolvedValue([
      createRecord({ id: "invite", event_type: "DIRECTOR_ONBOARDING_INVITATION_SENT" }),
      createRecord({
        id: "kyc_ok",
        event_type: "DIRECTOR_KYC_STATUS_UPDATED",
        metadata: { newKycStatus: "APPROVED" },
      }),
      createRecord({
        id: "kyc_wait",
        event_type: "DIRECTOR_KYC_STATUS_UPDATED",
        metadata: { newKycStatus: "WAIT_FOR_APPROVAL" },
      }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.id)).toEqual(["invite", "kyc_ok"]);
  });

  it("shows sophisticated status updates only to the investor when the value changes", async () => {
    prisma.onboardingAuditLog.findMany.mockResolvedValue([
      createRecord({
        id: "material",
        event_type: "INVESTOR_SOPHISTICATED_STATUS_UPDATED",
        organization_kind: "INVESTOR",
        metadata: { previousValue: false, newValue: true },
      }),
      createRecord({
        id: "noop",
        event_type: "INVESTOR_SOPHISTICATED_STATUS_UPDATED",
        organization_kind: "INVESTOR",
        metadata: { previousValue: true, newValue: true },
      }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "investor-org-1",
      portalType: "investor",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.id)).toEqual(["material"]);
  });
});
