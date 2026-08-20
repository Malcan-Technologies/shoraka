import type { Prisma } from "@prisma/client";
import { writeAccessAuditLogBestEffort } from "./writer";
import type { AuditRequestContext } from "../../../lib/audit/context";

describe("writeAccessAuditLogBestEffort", () => {
  const context: AuditRequestContext = {
    actorType: "USER",
    actorUserId: "ABCDE",
    source: "API",
    portal: "INVESTOR",
    ipAddress: "192.0.2.1",
    userAgent: "Jest",
    correlationId: "corr-1",
  };

  function txStub(overrides?: { create?: jest.Mock; findUnique?: jest.Mock }) {
    return {
      user: {
        findUnique:
          overrides?.findUnique ??
          jest.fn().mockResolvedValue({
            email: "user@example.com",
            first_name: "Ada",
            last_name: "Investor",
          }),
      },
      accessAuditLog: {
        create: overrides?.create ?? jest.fn().mockResolvedValue({}),
      },
    } as unknown as Prisma.TransactionClient;
  }

  it("writes USER_LOGGED_IN with COGNITO_OAUTH and actor snapshots", async () => {
    const create = jest.fn().mockResolvedValue({});
    await writeAccessAuditLogBestEffort(
      {
        eventType: "USER_LOGGED_IN",
        context,
        userId: "ABCDE",
        metadata: { loginMethod: "COGNITO_OAUTH", activeRole: "INVESTOR" },
      },
      txStub({ create })
    );

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.event_type).toBe("USER_LOGGED_IN");
    expect(data.source).toBe("API");
    expect(data.target_type).toBe("USER");
    expect(data.metadata).toEqual(
      expect.objectContaining({
        loginMethod: "COGNITO_OAUTH",
        actorName: "Ada Investor",
        actorEmail: "user@example.com",
      })
    );
  });

  it("does not throw when persistence fails", async () => {
    const create = jest.fn().mockRejectedValue(new Error("db down"));
    await expect(
      writeAccessAuditLogBestEffort(
        {
          eventType: "USER_LOGGED_OUT",
          context,
          userId: "ABCDE",
          metadata: {},
        },
        txStub({ create })
      )
    ).resolves.toBeUndefined();
  });
});
