const mockPrisma: {
  user: { findMany: jest.Mock };
  legalAdminAuditLog: { findMany: jest.Mock; count: jest.Mock };
} = {
  user: { findMany: jest.fn() },
  legalAdminAuditLog: { findMany: jest.fn(), count: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { LegalAdminAuditLogReader } from "./reader";

describe("LegalAdminAuditLogReader", () => {
  const reader = new LegalAdminAuditLogReader();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps rows to the camelCase DTO using metadata actor snapshots", async () => {
    mockPrisma.legalAdminAuditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        legal_document_id: "ld1",
        legal_document_version_id: "ver1",
        event_type: "LEGAL_DOCUMENT_VERSION_PUBLISHED",
        occurred_at: new Date("2026-08-13T01:00:00.000Z"),
        created_at: new Date("2026-08-13T01:00:00.000Z"),
        actor_type: "ADMIN",
        actor_user_id: "admin_1",
        organization_id: null,
        organization_kind: null,
        target_type: "LEGAL_DOCUMENT_VERSION",
        target_id: "ver1",
        source: "API",
        portal: "ADMIN",
        ip_address: "1.1.1.1",
        user_agent: "Mozilla/5.0",
        correlation_id: "c1",
        idempotency_key: null,
        metadata: {
          actorName: "Ada Admin",
          actorEmail: "ada@example.com",
          documentType: "TERMS_OF_USE",
          versionNumber: 2,
        },
      },
    ]);
    mockPrisma.legalAdminAuditLog.count.mockResolvedValue(1);

    const { logs, pagination } = await reader.list({
      page: 1,
      pageSize: 20,
    });

    expect(pagination.totalCount).toBe(1);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(logs[0].eventType).toBe("LEGAL_DOCUMENT_VERSION_PUBLISHED");
    expect(logs[0].occurredAt).toBe("2026-08-13T01:00:00.000Z");
    expect(logs[0].actor).toEqual({
      type: "ADMIN",
      userId: "admin_1",
      displayName: "Ada Admin",
      email: "ada@example.com",
    });
    expect(logs[0].metadata.documentType).toBe("TERMS_OF_USE");
  });

  it("maps the action query parameter to event_type", async () => {
    mockPrisma.legalAdminAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.legalAdminAuditLog.count.mockResolvedValue(0);

    await reader.list({
      page: 1,
      pageSize: 20,
      action: "LEGAL_DOCUMENT_CREATED",
    });

    expect(mockPrisma.legalAdminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event_type: "LEGAL_DOCUMENT_CREATED",
        }),
      })
    );
  });

  it("searches actor snapshots in metadata without requiring a JSON index", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ user_id: "admin_1" }]);
    mockPrisma.legalAdminAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.legalAdminAuditLog.count.mockResolvedValue(0);

    await reader.list({
      page: 1,
      pageSize: 20,
      search: "Ada",
    });

    const where = mockPrisma.legalAdminAuditLog.findMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: { path: ["actorName"], string_contains: "Ada" },
        }),
        expect.objectContaining({
          metadata: { path: ["actorEmail"], string_contains: "Ada" },
        }),
        expect.objectContaining({
          actor_user_id: { in: ["admin_1"] },
        }),
      ])
    );
  });
});
