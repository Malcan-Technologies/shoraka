import { SigningLogAdapter } from "./signing-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    signingAuditLog: { findMany: jest.fn(), count: jest.fn() },
    application: { findMany: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("../../../lib/prisma") as {
  prisma: {
    signingAuditLog: { findMany: jest.Mock; count: jest.Mock };
    application: { findMany: jest.Mock };
  };
};

describe("SigningLogAdapter", () => {
  const adapter = new SigningLogAdapter();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("owns signing events and not application events", () => {
    expect(adapter.domain).toBe("signing");
    expect(adapter.getEventTypes()).toEqual(
      expect.arrayContaining([
        "SIGNING_PACKAGE_SENT",
        "SIGNING_PACKAGE_COMPLETED",
        "SIGNING_PACKAGE_VOIDED",
        "SIGNING_PACKAGE_DECLINED",
        "SIGNING_PACKAGE_EXPIRED",
        "SIGNING_RECIPIENT_DECLINED",
        "SIGNING_EKYC_FAILED",
      ])
    );
    expect(adapter.getEventTypes()).not.toContain("SIGNING_PACKAGE_CREATED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_RECIPIENT_COMPLETED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_EKYC_STARTED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_EKYC_VERIFIED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_REMINDER_SENT");
    expect(adapter.getEventTypes()).not.toContain("CONTRACT_OFFER_ACCEPTED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_SESSION_OPENED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_RECIPIENT_VIEWED");
  });

  it("transforms SigningAuditLog rows", () => {
    const now = new Date();
    const activity = adapter.transform({
      id: "log-1",
      actor_user_id: "user-1",
      event_type: "SIGNING_PACKAGE_SENT",
      metadata: { provider: "SIGNINGCLOUD" },
      ip_address: null,
      user_agent: null,
      occurred_at: now,
      created_at: now,
      application_id: "app-1",
    } as never);

    expect(activity.domain).toBe("signing");
    expect(activity.source_table).toBe("signing_audit_logs");
    expect(activity.title).toBe("Signing Package Sent");
    expect(activity.references?.applicationId).toBe("app-1");
  });

  it("queries SigningAuditLog", async () => {
    prisma.signingAuditLog.findMany.mockResolvedValue([]);
    await adapter.query("user-1", { limit: 10, offset: 0 });
    expect(prisma.signingAuditLog.findMany).toHaveBeenCalled();
    expect(prisma.applicationAuditLog).toBeUndefined();
  });

  it("returns only the issuer signing lifecycle set", async () => {
    prisma.application.findMany.mockResolvedValue([{ id: "app-1" }]);
    prisma.signingAuditLog.findMany.mockResolvedValue([
      { id: "sent", event_type: "SIGNING_PACKAGE_SENT", application_id: "app-1" },
      { id: "created", event_type: "SIGNING_PACKAGE_CREATED", application_id: "app-1" },
      { id: "ekyc_failed", event_type: "SIGNING_EKYC_FAILED", application_id: "app-1" },
      { id: "reminder", event_type: "SIGNING_REMINDER_SENT", application_id: "app-1" },
    ]);

    const records = await adapter.query("user-1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.id)).toEqual(["sent", "ekyc_failed"]);
  });

  it("returns no signing activity for investors", async () => {
    const records = await adapter.query("user-1", {
      organizationId: "investor-org-1",
      portalType: "investor",
    });
    expect(records).toEqual([]);
    expect(prisma.signingAuditLog.findMany).not.toHaveBeenCalled();
  });
});
