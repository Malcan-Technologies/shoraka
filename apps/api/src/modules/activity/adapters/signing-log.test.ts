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
        "SIGNING_PACKAGE_CREATED",
        "SIGNING_PACKAGE_SENT",
        "SIGNING_PACKAGE_COMPLETED",
        "SIGNING_PACKAGE_VOIDED",
        "SIGNING_PACKAGE_DECLINED",
        "SIGNING_PACKAGE_EXPIRED",
        "SIGNING_RECIPIENT_COMPLETED",
        "SIGNING_EKYC_STARTED",
        "SIGNING_REMINDER_SENT",
      ])
    );
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
});
