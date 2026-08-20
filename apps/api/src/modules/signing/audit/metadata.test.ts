import { parseSigningAuditMetadata } from "./metadata";
import { SIGNING_AUDIT_EVENTS } from "./events";
import { expireSigningEnvelopeInTx, SIGNING_EXPIRY_TRIGGER } from "../expire-envelope";
import { writeSigningAuditLog } from "./writer";
import { toSigningAuditLogDto } from "./reader";
import type { SigningAuditLog } from "@prisma/client";

jest.mock("./writer", () => ({
  writeSigningAuditLog: jest.fn().mockResolvedValue(undefined),
}));

describe("Signing audit metadata", () => {
  it("stores completed hashes without s3 keys", () => {
    const parsed = parseSigningAuditMetadata("SIGNING_PACKAGE_COMPLETED", {
      actorName: null,
      actorEmail: null,
      provider: "SIGNINGCLOUD",
      completedAt: "2026-08-13T00:00:00.000Z",
      completionMethod: "WEBHOOK",
      signedDocumentHashes: [{ documentId: "doc-1", sha256: "abc", s3Key: "secret" }],
    });
    expect(parsed.signedDocumentHashes).toEqual([{ documentId: "doc-1", sha256: "abc" }]);
    expect(JSON.stringify(parsed)).not.toContain("s3Key");
    expect(JSON.stringify(parsed)).not.toContain("secret");
  });

  it("parses every catalogue event", () => {
    const samples: Record<(typeof SIGNING_AUDIT_EVENTS)[number], Record<string, unknown>> = {
      SIGNING_PACKAGE_CREATED: {
        actorName: null,
        actorEmail: null,
        applicationId: "app-1",
        provider: "SIGNINGCLOUD",
        recipientCount: 1,
        documentCount: 1,
      },
      SIGNING_PACKAGE_SENT: {
        actorName: null,
        actorEmail: null,
        provider: "SIGNINGCLOUD",
        sentAt: "2026-08-13T00:00:00.000Z",
        recipientCount: 2,
      },
      SIGNING_PACKAGE_COMPLETED: {
        actorName: null,
        actorEmail: null,
        provider: "SIGNINGCLOUD",
        completedAt: "2026-08-13T00:00:00.000Z",
        completionMethod: "RECONCILE",
        signedDocumentHashes: [{ documentId: "doc-1", sha256: "abc" }],
      },
      SIGNING_PACKAGE_VOIDED: {
        actorName: null,
        actorEmail: null,
        previousStatus: "SENT",
        newStatus: "VOIDED",
      },
      SIGNING_PACKAGE_DECLINED: {
        actorName: null,
        actorEmail: null,
        previousStatus: "SENT",
        newStatus: "DECLINED",
        provider: "SIGNINGCLOUD",
      },
      SIGNING_PACKAGE_EXPIRED: {
        actorName: null,
        actorEmail: null,
        previousStatus: "SENT",
        newStatus: "EXPIRED",
        expiresAt: null,
        trigger: "ENVELOPE_CLOCK",
      },
      SIGNING_RECIPIENT_COMPLETED: {
        actorName: null,
        actorEmail: null,
        recipientId: "r1",
        recipientRole: "director",
        previousStatus: "SENT",
        newStatus: "SIGNED",
      },
      SIGNING_RECIPIENT_DECLINED: {
        actorName: null,
        actorEmail: null,
        recipientId: "r1",
        recipientRole: "director",
        previousStatus: "SENT",
        newStatus: "DECLINED",
      },
      SIGNING_EKYC_STARTED: {
        actorName: null,
        actorEmail: null,
        email: "a@b.c",
        provider: "SIGNINGCLOUD",
        newStatus: "pending",
      },
      SIGNING_EKYC_VERIFIED: {
        actorName: null,
        actorEmail: null,
        email: "a@b.c",
        provider: "SIGNINGCLOUD",
        newStatus: "verified",
      },
      SIGNING_EKYC_FAILED: {
        actorName: null,
        actorEmail: null,
        email: "a@b.c",
        provider: "SIGNINGCLOUD",
        newStatus: "failed",
        reasonCode: "VERIFICATION_FAILED",
      },
      SIGNING_REMINDER_SENT: {
        actorName: null,
        actorEmail: null,
        recipientId: "r1",
        reminderType: "MANUAL",
      },
    };

    for (const eventType of SIGNING_AUDIT_EVENTS) {
      expect(() => parseSigningAuditMetadata(eventType, samples[eventType])).not.toThrow();
    }
  });
});

describe("expireSigningEnvelopeInTx", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes exactly one EXPIRED event when the status transition wins", async () => {
    const tx = {
      signingEnvelope: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const won = await expireSigningEnvelopeInTx(tx as never, {
      envelopeId: "env-1",
      previousStatus: "SENT",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      trigger: SIGNING_EXPIRY_TRIGGER.ENVELOPE_CLOCK,
      applicationId: "app-1",
    });
    expect(won).toBe(true);
    expect(writeSigningAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "SIGNING_PACKAGE_EXPIRED" }),
      tx
    );
  });

  it("writes no event when another expiry path already won", async () => {
    const tx = {
      signingEnvelope: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const won = await expireSigningEnvelopeInTx(tx as never, {
      envelopeId: "env-1",
      previousStatus: "SENT",
      expiresAt: null,
      trigger: SIGNING_EXPIRY_TRIGGER.OFFER_SIGNING_CLOCK,
      applicationId: "app-1",
    });
    expect(won).toBe(false);
    expect(writeSigningAuditLog).not.toHaveBeenCalled();
  });

  it("writes no event for an already closed envelope", async () => {
    const tx = {
      signingEnvelope: {
        updateMany: jest.fn(),
      },
    };
    const won = await expireSigningEnvelopeInTx(tx as never, {
      envelopeId: "env-1",
      previousStatus: "EXPIRED",
      expiresAt: null,
      trigger: SIGNING_EXPIRY_TRIGGER.ENVELOPE_CLOCK,
      applicationId: "app-1",
    });
    expect(won).toBe(false);
    expect(tx.signingEnvelope.updateMany).not.toHaveBeenCalled();
  });
});

describe("SigningAuditLog reader DTO", () => {
  it("maps camelCase fields and never exposes s3 keys from hashes", () => {
    const dto = toSigningAuditLogDto({
      id: "log-1",
      signing_envelope_id: "env-1",
      application_id: "app-1",
      event_type: "SIGNING_PACKAGE_COMPLETED",
      occurred_at: new Date("2026-08-13T12:00:00.000Z"),
      created_at: new Date("2026-08-13T12:00:00.000Z"),
      actor_type: "INTEGRATION",
      actor_user_id: null,
      organization_id: "org-1",
      organization_kind: "ISSUER",
      target_type: "ENVELOPE",
      target_id: "env-1",
      source: "WEBHOOK",
      portal: null,
      ip_address: null,
      user_agent: null,
      correlation_id: "c1",
      idempotency_key: null,
      metadata: {
        signedDocumentHashes: [{ documentId: "doc-1", sha256: "abc" }],
      },
    } as SigningAuditLog);

    expect(dto.eventType).toBe("SIGNING_PACKAGE_COMPLETED");
    expect(dto.occurredAt).toBe("2026-08-13T12:00:00.000Z");
    expect(dto.signingEnvelopeId).toBe("env-1");
    expect(dto.applicationId).toBe("app-1");
    expect(JSON.stringify(dto.metadata)).not.toContain("s3");
  });
});
