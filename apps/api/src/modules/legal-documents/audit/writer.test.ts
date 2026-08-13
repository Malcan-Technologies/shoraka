import type { Prisma } from "@prisma/client";
import { writeLegalAdminAuditLog } from "./writer";
import type { LegalAdminAuditContext } from "./context";

describe("writeLegalAdminAuditLog", () => {
  const context: LegalAdminAuditContext = {
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

  function txStub(overrides?: { create?: jest.Mock; findUnique?: jest.Mock }) {
    return {
      user: {
        findUnique: overrides?.findUnique ?? jest.fn().mockResolvedValue({
          email: "admin@example.com",
          first_name: "Ada",
          last_name: "Admin",
        }),
      },
      legalAdminAuditLog: {
        create: overrides?.create ?? jest.fn().mockResolvedValue({ id: "a1" }),
      },
    } as unknown as Prisma.TransactionClient;
  }

  it("writes camelCase metadata with actor snapshots and ADMIN/API/ADMIN context", async () => {
    const create = jest.fn().mockResolvedValue({ id: "a1" });
    const tx = txStub({ create });

    await writeLegalAdminAuditLog(tx, {
      legalDocumentId: "ld1",
      eventType: "LEGAL_DOCUMENT_CREATED",
      targetType: "LEGAL_DOCUMENT",
      targetId: "ld1",
      context,
      metadata: {
        documentType: "TERMS_OF_USE",
        title: "Terms",
        audience: "BOTH",
        requiredForOnboarding: true,
        publicVisibility: false,
        showInAccount: false,
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type: "LEGAL_DOCUMENT_CREATED",
        actor_type: "ADMIN",
        source: "API",
        portal: "ADMIN",
        organization_id: null,
        organization_kind: null,
        actor_user_id: "admin1",
        metadata: expect.objectContaining({
          actorName: "Ada Admin",
          actorEmail: "admin@example.com",
          documentType: "TERMS_OF_USE",
        }),
      }),
    });
  });

  it("rejects invalid metadata before insert", async () => {
    const create = jest.fn();
    const tx = txStub({ create });

    await expect(
      writeLegalAdminAuditLog(tx, {
        legalDocumentId: "ld1",
        eventType: "LEGAL_DOCUMENT_UPDATED",
        targetType: "LEGAL_DOCUMENT",
        targetId: "ld1",
        context,
        metadata: {
          documentType: "TERMS_OF_USE",
          changedFields: [],
          before: {},
          after: {},
        },
      })
    ).rejects.toThrow();

    expect(create).not.toHaveBeenCalled();
  });
});
