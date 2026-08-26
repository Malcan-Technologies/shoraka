import { UserRole } from "@prisma/client";

import { AUDIT_ACTOR_TYPE, AUDIT_ORGANIZATION_KIND, AUDIT_SOURCE } from "./context";
import { createAccessLogRow, createOnboardingLogRow, createSecurityLogRow } from "./account-logs";

/** Captures the payload a writer would persist, without touching a database. */
function fakeDb() {
  const created: Record<string, unknown[]> = {
    accessLog: [],
    securityLog: [],
    onboardingLog: [],
  };
  const model = (name: string) => ({
    create: jest.fn(async ({ data }: { data: unknown }) => {
      created[name].push(data);
      return data;
    }),
  });
  return {
    created,
    db: {
      accessLog: model("accessLog"),
      securityLog: model("securityLog"),
      onboardingLog: model("onboardingLog"),
      // Present so an accidental lookup is observable rather than silently mocked away.
      user: { findUnique: jest.fn() },
    } as never,
  };
}

describe("account log writers issue no read", () => {
  it("writes an access log without querying the actor", async () => {
    const { db, created } = fakeDb();
    const spy = (db as unknown as { user: { findUnique: jest.Mock } }).user.findUnique;

    await createAccessLogRow(
      {
        userId: "user-1",
        eventType: "LOGIN",
        portal: "investor",
        ipAddress: "203.0.113.5",
        userAgent: "agent",
        metadata: { attempt: 1 },
      },
      db
    );

    expect(spy).not.toHaveBeenCalled();
    expect(created.accessLog).toHaveLength(1);
  });
});

describe("access and security logs preserve their legacy columns", () => {
  it("writes every legacy access log column from the caller's own values", async () => {
    const { db, created } = fakeDb();

    await createAccessLogRow(
      {
        userId: "user-1",
        eventType: "LOGIN",
        portal: "investor",
        ipAddress: "203.0.113.5",
        userAgent: "agent",
        deviceInfo: "device",
        deviceType: "mobile",
        cognitoEvent: { challenge: "SRP" },
        success: false,
        metadata: { attempt: 2 },
      },
      db
    );

    expect(created.accessLog[0]).toMatchObject({
      user_id: "user-1",
      event_type: "LOGIN",
      portal: "investor",
      ip_address: "203.0.113.5",
      user_agent: "agent",
      device_info: "device",
      device_type: "mobile",
      cognito_event: { challenge: "SRP" },
      success: false,
      metadata: { attempt: 2 },
    });
  });

  it("defaults success to true, as the legacy writer did", async () => {
    const { db, created } = fakeDb();

    await createSecurityLogRow({ userId: "user-1", eventType: "PASSWORD_CHANGED" }, db);

    expect(created.securityLog[0]).toMatchObject({
      user_id: "user-1",
      event_type: "PASSWORD_CHANGED",
    });
  });

  it("passes metadata through byte-for-byte, adding no derived keys", async () => {
    const { db, created } = fakeDb();
    const metadata = { reason: "admin reset", previousStatus: "ACTIVE", nested: { a: [1, 2] } };

    await createSecurityLogRow({ userId: "u", eventType: "ACCOUNT_LOCKED", metadata }, db);

    expect((created.securityLog[0] as { metadata: unknown }).metadata).toEqual(metadata);
  });

  it("targets platform finance settings when settingsKey is present", async () => {
    const { db, created } = fakeDb();

    await createSecurityLogRow(
      {
        userId: "admin-1",
        eventType: "PLATFORM_FINANCE_SETTINGS_UPDATED",
        portal: "ADMIN",
        metadata: { settingsKey: "DEFAULT", previousValues: {}, nextValues: { gracePeriodDays: 9 } },
      },
      db
    );

    expect(created.securityLog[0]).toMatchObject({
      event_type: "PLATFORM_FINANCE_SETTINGS_UPDATED",
      actor_type: AUDIT_ACTOR_TYPE.ADMIN,
      source: AUDIT_SOURCE.API,
      target_type: "PLATFORM_FINANCE_SETTINGS",
      target_id: "DEFAULT",
      portal: "ADMIN",
    });
  });
});

describe("onboarding log actor attribution", () => {
  const base = {
    userId: "11111111-1111-4111-8111-111111111111",
    role: UserRole.INVESTOR,
    eventType: "FINAL_APPROVAL_COMPLETED",
  };

  async function actorFor(params: Parameters<typeof createOnboardingLogRow>[0]) {
    const { db, created } = fakeDb();
    await createOnboardingLogRow(params, db);
    return created.onboardingLog[0] as { actor_user_id: string | null; actor_type: string };
  }

  it("uses the explicit actor when the caller supplies one", async () => {
    const row = await actorFor({
      ...base,
      actorUserId: "22222222-2222-4222-8222-222222222222",
      metadata: { approvedBy: "admin" },
    });

    expect(row.actor_user_id).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("recovers an id-shaped actor recorded only in metadata", async () => {
    const row = await actorFor({
      ...base,
      metadata: { approvedBy: "33333333-3333-4333-8333-333333333333" },
    });

    expect(row.actor_user_id).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("stores no actor when metadata names a sentinel rather than a user", async () => {
    // Misattributing an admin decision to the applicant would be worse than recording nothing.
    for (const sentinel of ["admin", "system", "SYSTEM", "cron"]) {
      const row = await actorFor({ ...base, metadata: { updatedBy: sentinel } });
      expect(row.actor_user_id).toBeNull();
    }
  });

  it("attributes a self-service event to the subject when no actor hint exists", async () => {
    const row = await actorFor({ ...base, eventType: "ONBOARDING_STARTED" });

    expect(row.actor_user_id).toBe(base.userId);
  });
});

describe("onboarding log organization context", () => {
  it("derives the organization kind from the investor organization", async () => {
    const { db, created } = fakeDb();

    await createOnboardingLogRow(
      {
        userId: "u",
        role: UserRole.INVESTOR,
        eventType: "AML_APPROVED",
        investorOrganizationId: "org-1",
      },
      db
    );

    expect(created.onboardingLog[0]).toMatchObject({
      investor_organization_id: "org-1",
      organization_kind: AUDIT_ORGANIZATION_KIND.INVESTOR,
    });
  });

  it("derives the organization kind from the issuer organization", async () => {
    const { db, created } = fakeDb();

    await createOnboardingLogRow(
      {
        userId: "u",
        role: UserRole.ISSUER,
        eventType: "AML_APPROVED",
        issuerOrganizationId: "org-2",
      },
      db
    );

    expect(created.onboardingLog[0]).toMatchObject({
      issuer_organization_id: "org-2",
      organization_kind: AUDIT_ORGANIZATION_KIND.ISSUER,
    });
  });

  it("marks a provider callback as an integration write", async () => {
    const { db, created } = fakeDb();

    await createOnboardingLogRow(
      {
        userId: "u",
        role: UserRole.INVESTOR,
        eventType: "ONBOARDING_STATUS_UPDATED",
        context: {
          actorType: AUDIT_ACTOR_TYPE.INTEGRATION,
          source: AUDIT_SOURCE.WEBHOOK,
          actorUserId: null,
          portal: null,
          ipAddress: null,
          userAgent: null,
          correlationId: null,
        },
      },
      db
    );

    expect(created.onboardingLog[0]).toMatchObject({
      actor_type: AUDIT_ACTOR_TYPE.INTEGRATION,
      source: AUDIT_SOURCE.WEBHOOK,
    });
  });
});
