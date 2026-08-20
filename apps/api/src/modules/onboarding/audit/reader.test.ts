import { onboardingAuditLogReader } from "./reader";

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindUnique = jest.fn();
const mockUserFindMany = jest.fn();

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    onboardingAuditLog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
  },
}));

const occurredAt = new Date("2026-08-13T00:00:00.000Z");

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    onboarding_id: "ob-1",
    event_type: "ONBOARDING_STARTED",
    occurred_at: occurredAt,
    created_at: occurredAt,
    actor_type: "USER",
    actor_user_id: "USR01",
    subject_user_id: "USR02",
    organization_id: "org-1",
    organization_kind: "INVESTOR",
    organization_type: "PERSONAL",
    target_type: "REGTANK_ONBOARDING",
    target_id: "LD001",
    source: "API",
    portal: "INVESTOR",
    ip_address: "127.0.0.1",
    user_agent: "Mozilla/5.0",
    correlation_id: "corr-1",
    idempotency_key: null,
    metadata: { actorName: "Ada Admin", actorEmail: "ada@example.com", requestId: "LD001" },
    ...overrides,
  };
}

describe("OnboardingAuditLogReader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([auditRow()]);
    mockCount.mockResolvedValue(1);
    mockFindUnique.mockResolvedValue(auditRow());
    mockUserFindMany.mockResolvedValue([]);
  });

  it("maps userId to subject_user_id and organizationId to organization_id", async () => {
    await onboardingAuditLogReader.findAll({
      page: 1,
      pageSize: 20,
      userId: "USR02",
      organizationId: "org-1",
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subject_user_id: "USR02",
          organization_id: "org-1",
        }),
      })
    );
  });

  it("returns camelCase DTOs and derives device from User-Agent", async () => {
    const { logs, total } = await onboardingAuditLogReader.findAll({ page: 1, pageSize: 20 });
    expect(total).toBe(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        id: "log-1",
        eventType: "ONBOARDING_STARTED",
        subjectUserId: "USR02",
        userId: "USR02",
        organizationId: "org-1",
        ipAddress: "127.0.0.1",
        actor: expect.objectContaining({
          type: "USER",
          userId: "USR01",
          displayName: "Ada Admin",
        }),
      })
    );
    expect(logs[0].deviceInfo).toEqual(expect.any(String));
    expect(logs[0]).not.toHaveProperty("event_type");
  });

  it("export queries OnboardingAuditLog without pagination page semantics", async () => {
    const rows = await onboardingAuditLogReader.findAllForExport({ userId: "USR02" });
    expect(rows).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ subject_user_id: "USR02" }),
        take: 10_000,
      })
    );
  });
});
