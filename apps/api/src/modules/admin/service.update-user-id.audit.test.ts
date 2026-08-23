import type { Request } from "express";

const mockUsers = new Map<
  string,
  { first_name: string; last_name: string; email: string; user_id: string }
>();
const mockCreatedAuditLogs: Array<Record<string, unknown>> = [];
let mockAuditCreateImpl: () => Promise<unknown> = async () => ({});

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../../lib/http/request-utils", () => ({
  extractRequestMetadata: () => ({
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    deviceInfo: "test",
    deviceType: "desktop",
  }),
  getClientIp: () => "127.0.0.1",
}));

function snapshotUser(userId: string) {
  const user = mockUsers.get(userId);
  return user
    ? { email: user.email, first_name: user.first_name, last_name: user.last_name }
    : null;
}

const mockTx = {
  user: {
    findUnique: jest.fn(async ({ where }: { where: { user_id: string } }) =>
      snapshotUser(where.user_id)
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { user_id: string };
        data: { user_id: string };
      }) => {
        const current = mockUsers.get(where.user_id);
        if (!current) {
          throw new Error("User not found");
        }
        mockUsers.delete(where.user_id);
        const updated = { ...current, user_id: data.user_id };
        mockUsers.set(data.user_id, updated);
        return updated;
      }
    ),
  },
  securityAuditLog: {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const result = await mockAuditCreateImpl();
      mockCreatedAuditLogs.push(data);
      return result;
    }),
  },
};

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { user_id: string } }) =>
        mockUsers.get(where.user_id) ?? null
      ),
    },
    $transaction: async (fn: (client: typeof mockTx) => Promise<unknown>) => {
      const snapshot = new Map(mockUsers);
      try {
        return await fn(mockTx);
      } catch (error) {
        mockUsers.clear();
        for (const [key, value] of snapshot) {
          mockUsers.set(key, value);
        }
        throw error;
      }
    },
  },
}));

import { AdminService } from "./service";

function makeReq(actorUserId: string): Request {
  return {
    headers: { "user-agent": "jest" },
    ip: "127.0.0.1",
    user: { user_id: actorUserId, roles: ["ADMIN"] },
  } as unknown as Request;
}

describe("AdminService.updateUserId actor snapshot", () => {
  const service = new AdminService();

  beforeEach(() => {
    mockUsers.clear();
    mockCreatedAuditLogs.length = 0;
    mockAuditCreateImpl = async () => ({});
    jest.clearAllMocks();
  });

  it("keeps the admin actor snapshot when changing another user's public ID", async () => {
    mockUsers.set("ADMAA", {
      user_id: "ADMAA",
      first_name: "Ada",
      last_name: "Admin",
      email: "ada@cashsouk.com",
    });
    mockUsers.set("B0001", {
      user_id: "B0001",
      first_name: "Bea",
      last_name: "Borrower",
      email: "bea@example.com",
    });

    await service.updateUserId(makeReq("ADMAA"), "B0001", "B0002");

    expect(mockUsers.has("B0001")).toBe(false);
    expect(mockUsers.get("B0002")?.email).toBe("bea@example.com");
    expect(mockCreatedAuditLogs).toHaveLength(1);
    expect(mockCreatedAuditLogs[0]).toEqual(
      expect.objectContaining({
        event_type: "USER_PUBLIC_ID_CHANGED",
        actor_type: "ADMIN",
        actor_user_id: "ADMAA",
        subject_user_id: "B0002",
        target_type: "USER",
        target_id: "B0002",
        metadata: expect.objectContaining({
          actorName: "Ada Admin",
          actorEmail: "ada@cashsouk.com",
          previousUserId: "B0001",
          newUserId: "B0002",
        }),
      })
    );
  });

  it("preserves actorName and actorEmail when an admin changes their own public ID", async () => {
    mockUsers.set("QPSYO", {
      user_id: "QPSYO",
      first_name: "Max",
      last_name: "Chng",
      email: "max.chng@truestack.my",
    });

    await service.updateUserId(makeReq("QPSYO"), "QPSYO", "QPSYP");

    expect(mockUsers.has("QPSYO")).toBe(false);
    expect(mockUsers.get("QPSYP")?.email).toBe("max.chng@truestack.my");
    expect(mockCreatedAuditLogs).toHaveLength(1);
    expect(mockCreatedAuditLogs[0]).toEqual(
      expect.objectContaining({
        event_type: "USER_PUBLIC_ID_CHANGED",
        actor_user_id: "QPSYO",
        subject_user_id: "QPSYP",
        target_id: "QPSYP",
        metadata: expect.objectContaining({
          actorName: "Max Chng",
          actorEmail: "max.chng@truestack.my",
          previousUserId: "QPSYO",
          newUserId: "QPSYP",
        }),
      })
    );
    expect((mockCreatedAuditLogs[0].metadata as { actorName: string | null }).actorName).not.toBeNull();
    expect((mockCreatedAuditLogs[0].metadata as { actorEmail: string | null }).actorEmail).not.toBeNull();
  });

  it("rolls back the user ID mutation when the Security audit write throws", async () => {
    mockUsers.set("QPSYO", {
      user_id: "QPSYO",
      first_name: "Max",
      last_name: "Chng",
      email: "max.chng@truestack.my",
    });
    mockAuditCreateImpl = async () => {
      throw new Error("audit write failed");
    };

    await expect(service.updateUserId(makeReq("QPSYO"), "QPSYO", "QPSYP")).rejects.toThrow(
      "audit write failed"
    );

    expect(mockUsers.has("QPSYO")).toBe(true);
    expect(mockUsers.has("QPSYP")).toBe(false);
    expect(mockCreatedAuditLogs).toHaveLength(0);
  });
});
