import fs from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { writeNotificationBroadcastProcessedAudit } from "./writer";
import type { NotificationBroadcastAuditContext } from "./context";

describe("writeNotificationBroadcastProcessedAudit", () => {
  const context: NotificationBroadcastAuditContext = {
    actorType: "ADMIN",
    actorUserId: "admin1",
    organizationId: null,
    organizationKind: null,
    source: "API",
    portal: "ADMIN",
    ipAddress: "192.0.2.5",
    userAgent: "Jest",
    correlationId: "corr-1",
    idempotencyKey: null,
  };

  const metadata = {
    notificationTypeId: "system_announcement",
    notificationTypeName: "System Announcement",
    portalTargets: ["INVESTOR", "ISSUER"] as Array<"INVESTOR" | "ISSUER">,
    audienceType: "INVESTORS",
    groupId: null,
    targetedCount: 2,
    createdCount: 2,
    skippedCount: 0,
    failedCount: 0,
    title: "Hello",
    message: "World",
    channelMode: "EXPLICIT_OVERRIDE" as const,
    sendToPlatform: true,
    sendToEmail: false,
    linkPath: null,
    expiresAt: null,
  };

  function txStub(overrides?: { create?: jest.Mock; findUnique?: jest.Mock }) {
    return {
      user: {
        findUnique:
          overrides?.findUnique ??
          jest.fn().mockResolvedValue({
            email: "admin@example.com",
            first_name: "Ada",
            last_name: "Admin",
          }),
      },
      notificationBroadcastAuditLog: {
        create: overrides?.create ?? jest.fn().mockResolvedValue({}),
      },
    } as unknown as Prisma.TransactionClient;
  }

  it("writes PROCESSED with target_id equal to generated id and actor snapshots", async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = txStub({ create });

    const id = await writeNotificationBroadcastProcessedAudit(
      {
        eventType: "NOTIFICATION_BROADCAST_PROCESSED",
        context,
        audienceType: "INVESTORS",
        notificationTypeId: "system_announcement",
        metadata,
      },
      tx
    );

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.id).toBe(id);
    expect(data.target_id).toBe(id);
    expect(data.target_type).toBe("NOTIFICATION_BROADCAST");
    expect(data.event_type).toBe("NOTIFICATION_BROADCAST_PROCESSED");
    expect(data.actor_type).toBe("ADMIN");
    expect(data.source).toBe("API");
    expect(data.portal).toBe("ADMIN");
    expect(data.organization_id).toBeNull();
    expect(data.organization_kind).toBeNull();
    expect(data.idempotency_key).toBeNull();
    expect(data.audience_type).toBe("INVESTORS");
    expect(data.notification_type_id).toBe("system_announcement");
    expect(data.metadata).toEqual(
      expect.objectContaining({
        actorName: "Ada Admin",
        actorEmail: "admin@example.com",
        targetedCount: 2,
        createdCount: 2,
      })
    );
  });

  it("rejects invalid metadata before insert", async () => {
    const create = jest.fn();
    const tx = txStub({ create });

    await expect(
      writeNotificationBroadcastProcessedAudit(
        {
          eventType: "NOTIFICATION_BROADCAST_PROCESSED",
          context,
          audienceType: "INVESTORS",
          notificationTypeId: "system_announcement",
          metadata: { ...metadata, createdCount: 0 },
        },
        tx
      )
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("NotificationBroadcastAuditLog append-only source", () => {
  it("does not call update/delete/deleteMany/upsert in notification module source", () => {
    const dir = path.join(__dirname, "..");
    const files = fs.readdirSync(dir, { recursive: true }) as string[];
    const sources = files
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".spec.ts"))
      .map((file) => fs.readFileSync(path.join(dir, file), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/notificationBroadcastAuditLog\.(update|delete|deleteMany|upsert)\s*\(/);
    expect(sources).not.toMatch(/prisma\.notificationLog\.(create|update|delete|findMany|count)\s*\(/);
  });
});
