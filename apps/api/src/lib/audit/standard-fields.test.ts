import {
  AUDIT_ACTOR_TYPE,
  AUDIT_PORTAL,
  AUDIT_SOURCE,
  AUDIT_TARGET_TYPE,
  systemAuditContext,
  webhookAuditContext,
} from "./context";
import { changedFieldsOf } from "./snapshot";
import { resolveStandardAuditFields } from "./standard-fields";

describe("resolveStandardAuditFields: an explicit caller value always wins", () => {
  const context = {
    actorUserId: "ctx-user",
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    source: AUDIT_SOURCE.API,
    portal: AUDIT_PORTAL.ADMIN,
    ipAddress: "203.0.113.9",
    userAgent: "ctx-agent",
    correlationId: "ctx-correlation",
  };

  it("prefers the legacy per-call value over the context", () => {
    const resolved = resolveStandardAuditFields({
      context,
      ipAddress: "198.51.100.4",
      userAgent: "call-agent",
      correlationId: "call-correlation",
      portal: AUDIT_PORTAL.ISSUER,
    });

    expect(resolved.ip_address).toBe("198.51.100.4");
    expect(resolved.user_agent).toBe("call-agent");
    expect(resolved.correlation_id).toBe("call-correlation");
    expect(resolved.portal).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("honours an explicit null as 'record no value' instead of falling back to the context", () => {
    const resolved = resolveStandardAuditFields({
      context,
      ipAddress: null,
      userAgent: null,
      correlationId: null,
    });

    expect(resolved.ip_address).toBeNull();
    expect(resolved.user_agent).toBeNull();
    expect(resolved.correlation_id).toBeNull();
  });

  it("fills only the gaps when the call site omits a value", () => {
    const resolved = resolveStandardAuditFields({ context });

    expect(resolved.ip_address).toBe("203.0.113.9");
    expect(resolved.user_agent).toBe("ctx-agent");
    expect(resolved.correlation_id).toBe("ctx-correlation");
    expect(resolved.portal).toBe(AUDIT_PORTAL.ADMIN);
  });

  it("normalizes a blank header to null rather than storing an empty string as evidence", () => {
    const resolved = resolveStandardAuditFields({ ipAddress: "", userAgent: "" });

    expect(resolved.ip_address).toBeNull();
    expect(resolved.user_agent).toBeNull();
  });
});

describe("resolveStandardAuditFields: source and actor stay consistent", () => {
  it("labels an actorless write INTERNAL rather than claiming an API request", () => {
    const resolved = resolveStandardAuditFields({ systemWhenActorless: true });

    expect(resolved.actor_type).toBe(AUDIT_ACTOR_TYPE.SYSTEM);
    expect(resolved.source).toBe(AUDIT_SOURCE.INTERNAL);
  });

  it("labels an attributed write API", () => {
    const resolved = resolveStandardAuditFields({
      actorUserId: "user-1",
      systemWhenActorless: true,
    });

    expect(resolved.source).toBe(AUDIT_SOURCE.API);
  });

  it("attributes a webhook write to the provider, not to a user", () => {
    const resolved = resolveStandardAuditFields({ context: webhookAuditContext() });

    expect(resolved.source).toBe(AUDIT_SOURCE.WEBHOOK);
    expect(resolved.actor_type).toBe(AUDIT_ACTOR_TYPE.INTEGRATION);
    expect(resolved.actor_user_id).toBeNull();
  });

  it("attributes a scheduled write to the system", () => {
    const resolved = resolveStandardAuditFields({ context: systemAuditContext() });

    expect(resolved.source).toBe(AUDIT_SOURCE.SYSTEM_JOB);
    expect(resolved.actor_type).toBe(AUDIT_ACTOR_TYPE.SYSTEM);
  });

  it("keeps SYS identity on a scheduled write without treating it as Admin", () => {
    const resolved = resolveStandardAuditFields({
      actorUserId: "SYS",
      context: systemAuditContext({
        actorUserId: "SYS",
        correlationId: "cron:note-listing-expiry",
      }),
    });

    expect(resolved.actor_user_id).toBe("SYS");
    expect(resolved.actor_type).toBe(AUDIT_ACTOR_TYPE.SYSTEM);
    expect(resolved.source).toBe(AUDIT_SOURCE.SYSTEM_JOB);
    expect(resolved.portal).toBeNull();
    expect(resolved.correlation_id).toBe("cron:note-listing-expiry");
  });

  it("attributes a human Admin mutation as ADMIN / API", () => {
    const resolved = resolveStandardAuditFields({
      actorUserId: "admin-1",
      portal: AUDIT_PORTAL.ADMIN,
    });

    expect(resolved.actor_type).toBe(AUDIT_ACTOR_TYPE.ADMIN);
    expect(resolved.source).toBe(AUDIT_SOURCE.API);
  });

  it("keeps WEBHOOK when a related user id is present", () => {
    const resolved = resolveStandardAuditFields({
      actorUserId: "issuer-1",
      portal: AUDIT_PORTAL.ISSUER,
      context: webhookAuditContext({ actorUserId: "issuer-1" }),
    });

    expect(resolved.source).toBe(AUDIT_SOURCE.WEBHOOK);
    expect(resolved.actor_user_id).toBe("issuer-1");
    expect(resolved.actor_type).toBe(AUDIT_ACTOR_TYPE.INTEGRATION);
    expect(resolved.portal).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("attributes actorless human checkout sync as API without inventing a portal", () => {
    const resolved = resolveStandardAuditFields({
      context: {
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorUserId: null,
        source: AUDIT_SOURCE.API,
        portal: null,
        ipAddress: null,
        userAgent: null,
        correlationId: "sync:gp-1",
      },
      systemWhenActorless: true,
    });

    expect(resolved.source).toBe(AUDIT_SOURCE.API);
    expect(resolved.actor_type).toBe(AUDIT_ACTOR_TYPE.SYSTEM);
    expect(resolved.actor_user_id).toBeNull();
    expect(resolved.portal).toBeNull();
  });

  it("lets the call site override the source explicitly", () => {
    const resolved = resolveStandardAuditFields({
      context: webhookAuditContext(),
      source: AUDIT_SOURCE.INTERNAL,
    });

    expect(resolved.source).toBe(AUDIT_SOURCE.INTERNAL);
  });
});

describe("resolveStandardAuditFields: target and organization are never invented", () => {
  it("returns null for every field the caller did not supply", () => {
    const resolved = resolveStandardAuditFields({});

    expect(resolved.target_type).toBeNull();
    expect(resolved.target_id).toBeNull();
    expect(resolved.organization_id).toBeNull();
    expect(resolved.organization_kind).toBeNull();
    expect(resolved.correlation_id).toBeNull();
  });

  it("passes the supplied target through unchanged", () => {
    const resolved = resolveStandardAuditFields({
      targetType: AUDIT_TARGET_TYPE.APPLICATION,
      targetId: "app-1",
    });

    expect(resolved.target_type).toBe(AUDIT_TARGET_TYPE.APPLICATION);
    expect(resolved.target_id).toBe("app-1");
  });
});

describe("changedFieldsOf", () => {
  it("reports only the fields that differ, sorted", () => {
    expect(
      changedFieldsOf({ status: "DRAFT", amount: 10, note: "x" }, { status: "LIVE", amount: 10 })
    ).toEqual(["note", "status"]);
  });

  it("treats an added or removed key as changed", () => {
    expect(changedFieldsOf({}, { status: "LIVE" })).toEqual(["status"]);
    expect(changedFieldsOf({ status: "LIVE" }, {})).toEqual(["status"]);
  });

  it("compares nested structures by value", () => {
    expect(changedFieldsOf({ terms: { rate: 5 } }, { terms: { rate: 5 } })).toEqual([]);
    expect(changedFieldsOf({ terms: { rate: 5 } }, { terms: { rate: 6 } })).toEqual(["terms"]);
  });

  it("does not throw on BigInt values, which reach it from counter columns", () => {
    expect(() => changedFieldsOf({ seq: 1n }, { seq: 2n })).not.toThrow();
    expect(changedFieldsOf({ seq: 1n }, { seq: 2n })).toEqual(["seq"]);
    expect(changedFieldsOf({ seq: 1n }, { seq: 1n })).toEqual([]);
  });

  it("handles null and undefined inputs", () => {
    expect(changedFieldsOf(null, null)).toEqual([]);
    expect(changedFieldsOf(undefined, { a: 1 })).toEqual(["a"]);
  });
});
