import {
  mergeApplicationAndSigningAuditLogs,
  toApplicationAuditLogDto,
} from "./reader";
import { toSigningAuditLogDto } from "../../signing/audit/reader";
import type { ApplicationAuditLog, SigningAuditLog } from "@prisma/client";

function appRow(
  id: string,
  occurredAt: string,
  eventType = "APPLICATION_CREATED"
): ApplicationAuditLog {
  return {
    id,
    application_id: "app-1",
    event_type: eventType,
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

function signingRow(
  id: string,
  occurredAt: string,
  eventType = "SIGNING_PACKAGE_SENT"
): SigningAuditLog {
  return {
    id,
    signing_envelope_id: "env-1",
    application_id: "app-1",
    event_type: eventType,
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
    const merged = mergeApplicationAndSigningAuditLogs(
      [
        toApplicationAuditLogDto(appRow("a2", "2026-08-13T10:00:00.000Z")),
        toApplicationAuditLogDto(appRow("a1", "2026-08-13T12:00:00.000Z")),
      ],
      [
        toSigningAuditLogDto(signingRow("s1", "2026-08-13T12:00:00.000Z")),
        toSigningAuditLogDto(signingRow("s2", "2026-08-13T11:00:00.000Z")),
      ]
    );
    expect(merged.map((row) => row.id)).toEqual(["s1", "a1", "s2", "a2"]);
  });

  it("preserves applicationId on Application rows and both ids on Signing rows", () => {
    const merged = mergeApplicationAndSigningAuditLogs(
      [toApplicationAuditLogDto(appRow("a1", "2026-08-13T12:00:00.000Z"))],
      [toSigningAuditLogDto(signingRow("s1", "2026-08-13T11:00:00.000Z"))]
    );

    const applicationRow = merged.find((row) => row.id === "a1");
    const signingRowDto = merged.find((row) => row.id === "s1");

    expect(applicationRow?.applicationId).toBe("app-1");
    expect(applicationRow?.signingEnvelopeId).toBeNull();
    expect(signingRowDto?.applicationId).toBe("app-1");
    expect(signingRowDto?.signingEnvelopeId).toBe("env-1");
  });

  it("keeps forensic actor, source, portal, and correlation fields", () => {
    const dto = toApplicationAuditLogDto(appRow("a1", "2026-08-13T12:00:00.000Z"));
    expect(dto.actor).toEqual({
      type: "USER",
      userId: "u1",
      displayName: null,
      email: null,
    });
    expect(dto.source).toBe("API");
    expect(dto.portal).toBe("ISSUER");
    expect(dto.correlationId).toBeNull();
    expect(dto.createdAt).toBe("2026-08-13T12:00:00.000Z");
  });

  it("includes all Application and Signing rows without an Activity allowlist", () => {
    const merged = mergeApplicationAndSigningAuditLogs(
      [
        toApplicationAuditLogDto(
          appRow("a-doc", "2026-08-13T10:00:00.000Z", "APPLICATION_DOCUMENT_UPLOADED")
        ),
        toApplicationAuditLogDto(
          appRow("a-item", "2026-08-13T09:00:00.000Z", "APPLICATION_ITEM_REVIEW_UPDATED")
        ),
      ],
      [
        toSigningAuditLogDto(
          signingRow("s-ekyc", "2026-08-13T11:00:00.000Z", "SIGNING_EKYC_STARTED")
        ),
        toSigningAuditLogDto(
          signingRow("s-remind", "2026-08-13T08:00:00.000Z", "SIGNING_REMINDER_SENT")
        ),
      ]
    );

    expect(merged.map((row) => row.eventType)).toEqual([
      "SIGNING_EKYC_STARTED",
      "APPLICATION_DOCUMENT_UPLOADED",
      "APPLICATION_ITEM_REVIEW_UPDATED",
      "SIGNING_REMINDER_SENT",
    ]);
  });
});
