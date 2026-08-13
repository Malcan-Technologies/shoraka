import { toApplicationAuditLogDto } from "./reader";
import { toSigningAuditLogDto } from "../../signing/audit/reader";
import type { ApplicationAuditLog, SigningAuditLog } from "@prisma/client";

function merge(a: ReturnType<typeof toApplicationAuditLogDto>[], b: ReturnType<typeof toSigningAuditLogDto>[]) {
  const signingAsTimeline = b.map((log) => ({
    id: log.id,
    eventType: log.eventType,
    occurredAt: log.occurredAt,
    createdAt: log.createdAt,
    actor: log.actor,
    organizationId: log.organizationId,
    organizationKind: log.organizationKind,
    target: log.target,
    source: log.source,
    portal: log.portal,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    correlationId: log.correlationId,
    metadata: log.metadata,
  }));
  return [...a, ...signingAsTimeline].sort((x, y) => {
    const byTime = y.occurredAt.localeCompare(x.occurredAt);
    if (byTime !== 0) return byTime;
    return y.id.localeCompare(x.id);
  });
}

function appRow(id: string, occurredAt: string): ApplicationAuditLog {
  return {
    id,
    application_id: "app-1",
    event_type: "APPLICATION_CREATED",
    occurred_at: new Date(occurredAt),
    created_at: new Date(occurredAt),
    actor_type: "USER",
    actor_user_id: "u1",
    organization_id: "org-1",
    organization_kind: "ISSUER",
    target_type: "APPLICATION",
    target_id: "app-1",
    source: "API",
    portal: "ISSUER",
    ip_address: null,
    user_agent: null,
    correlation_id: null,
    idempotency_key: null,
    metadata: {},
  };
}

function signingRow(id: string, occurredAt: string): SigningAuditLog {
  return {
    id,
    signing_envelope_id: "env-1",
    application_id: "app-1",
    event_type: "SIGNING_PACKAGE_SENT",
    occurred_at: new Date(occurredAt),
    created_at: new Date(occurredAt),
    actor_type: "USER",
    actor_user_id: "u1",
    organization_id: "org-1",
    organization_kind: "ISSUER",
    target_type: "ENVELOPE",
    target_id: "env-1",
    source: "API",
    portal: "ISSUER",
    ip_address: null,
    user_agent: null,
    correlation_id: null,
    idempotency_key: null,
    metadata: {},
  };
}

describe("application timeline merge", () => {
  it("sorts occurredAt DESC then id DESC across both tables", () => {
    const merged = merge(
      [toApplicationAuditLogDto(appRow("a2", "2026-08-13T10:00:00.000Z")), toApplicationAuditLogDto(appRow("a1", "2026-08-13T12:00:00.000Z"))],
      [
        toSigningAuditLogDto(signingRow("s1", "2026-08-13T12:00:00.000Z")),
        toSigningAuditLogDto(signingRow("s2", "2026-08-13T11:00:00.000Z")),
      ]
    );
    expect(merged.map((row) => row.id)).toEqual(["s1", "a1", "s2", "a2"]);
  });
});
