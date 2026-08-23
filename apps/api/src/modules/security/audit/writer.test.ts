import fs from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { writeSecurityAuditLog, writeSecurityAuditLogBestEffort } from "./writer";
import type { AuditRequestContext } from "../../../lib/audit/context";

describe("writeSecurityAuditLog", () => {
  const context: AuditRequestContext = {
    actorType: "ADMIN",
    actorUserId: "ADMIN",
    source: "API",
    portal: "ADMIN",
    ipAddress: "192.0.2.8",
    userAgent: "Jest",
    correlationId: "corr-s",
  };

  function txStub(overrides?: { create?: jest.Mock }) {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: "admin@example.com",
          first_name: "Ada",
          last_name: "Admin",
        }),
      },
      securityAuditLog: {
        create: overrides?.create ?? jest.fn().mockResolvedValue({}),
      },
    } as unknown as Prisma.TransactionClient;
  }

  it("writes actor vs subject and ADMIN_ROLE target", async () => {
    const create = jest.fn().mockResolvedValue({});
    await writeSecurityAuditLog(
      {
        eventType: "ADMIN_ROLE_CREATED",
        context,
        subjectUserId: null,
        targetType: "ADMIN_ROLE",
        targetId: "OPS",
        metadata: { roleKey: "OPS", roleName: "Operations" },
      },
      txStub({ create })
    );

    const data = create.mock.calls[0][0].data;
    expect(data.event_type).toBe("ADMIN_ROLE_CREATED");
    expect(data.subject_user_id).toBeNull();
    expect(data.target_type).toBe("ADMIN_ROLE");
    expect(data.metadata).toEqual(
      expect.objectContaining({
        roleKey: "OPS",
        actorEmail: "admin@example.com",
      })
    );
  });

  it("uses a provided actor snapshot instead of re-querying the actor", async () => {
    const create = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue(null);
    await writeSecurityAuditLog(
      {
        eventType: "USER_PUBLIC_ID_CHANGED",
        context: { ...context, actorUserId: "QPSYO" },
        subjectUserId: "QPSYP",
        targetType: "USER",
        targetId: "QPSYP",
        metadata: { previousUserId: "QPSYO", newUserId: "QPSYP" },
        actorSnapshot: { name: "Max Chng", email: "max.chng@truestack.my" },
      },
      {
        user: { findUnique },
        securityAuditLog: { create },
      } as unknown as Prisma.TransactionClient
    );

    expect(findUnique).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
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
  });

  it("still loads actorName and actorEmail when no snapshot override is supplied", async () => {
    const create = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue({
      email: "admin@example.com",
      first_name: "Ada",
      last_name: "Admin",
    });
    await writeSecurityAuditLog(
      {
        eventType: "USER_PROFILE_UPDATED_BY_ADMIN",
        context,
        subjectUserId: "USER1",
        targetType: "USER",
        targetId: "USER1",
        metadata: {
          changedFields: ["phone"],
          before: { phone: "+60165584792" },
          after: { phone: "+60165584793" },
        },
      },
      {
        user: { findUnique },
        securityAuditLog: { create },
      } as unknown as Prisma.TransactionClient
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: { user_id: "ADMIN" },
      select: { email: true, first_name: true, last_name: true },
    });
    expect(create.mock.calls[0][0].data.metadata).toEqual(
      expect.objectContaining({
        actorName: "Ada Admin",
        actorEmail: "admin@example.com",
      })
    );
  });

  it("rejects invalid metadata before insert", async () => {
    const create = jest.fn();
    await expect(
      writeSecurityAuditLog(
        {
          eventType: "PASSWORD_CHANGE_FAILED",
          context,
          subjectUserId: "USER1",
          targetType: "USER",
          targetId: "USER1",
          metadata: { reason: "missing reasonCode" },
        },
        txStub({ create })
      )
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("writeSecurityAuditLogBestEffort", () => {
  const context: AuditRequestContext = {
    actorType: "ADMIN",
    actorUserId: "ADMIN",
    source: "API",
    portal: "ADMIN",
    ipAddress: "192.0.2.8",
    userAgent: "Jest",
    correlationId: "corr-s",
  };

  it("does not throw when persistence fails", async () => {
    const create = jest.fn().mockRejectedValue(new Error("db down"));
    await expect(
      writeSecurityAuditLogBestEffort(
        {
          eventType: "ADMIN_ACCESS_DENIED",
          context,
          subjectUserId: "ADMIN",
          targetType: "ADMIN_ROUTE",
          targetId: "/v1/admin/roles",
          metadata: {
            method: "GET",
            path: "/v1/admin/roles",
            reasonCode: "INSUFFICIENT_PERMISSIONS",
          },
        },
        {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              email: "admin@example.com",
              first_name: "Ada",
              last_name: "Admin",
            }),
          },
          securityAuditLog: { create },
        } as unknown as Prisma.TransactionClient
      )
    ).resolves.toBeUndefined();
  });
});

describe("SecurityAuditLog append-only source", () => {
  it("does not call update/delete/deleteMany/upsert on SecurityAuditLog", () => {
    const roots = [
      path.join(__dirname, ".."),
      path.join(__dirname, "../../admin"),
      path.join(__dirname, "../../auth"),
      path.join(__dirname, "../../organization"),
      path.join(__dirname, "../../notification"),
      path.join(__dirname, "../../../lib/auth"),
    ];
    const sources = roots
      .flatMap((dir) =>
        fs.existsSync(dir)
          ? (fs.readdirSync(dir, { recursive: true }) as string[]).map((file) =>
              path.join(dir, file)
            )
          : []
      )
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".spec.ts"))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/securityAuditLog\.(update|delete|deleteMany|upsert)\s*\(/);
    expect(sources).not.toMatch(/accessAuditLog\.(update|delete|deleteMany|upsert)\s*\(/);
  });
});
