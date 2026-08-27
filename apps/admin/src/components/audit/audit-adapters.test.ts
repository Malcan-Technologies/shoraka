import type { LegalDocumentAuditLogListItem, ProductLogResponse } from "@cashsouk/types";
import {
  accessLogToAuditDetail,
  applicationLogToAuditDetail,
  contractEventToAuditDetail,
  legalAuditToAuditDetail,
  noteEventToAuditDetail,
  notificationRelatedReference,
  productLogToAuditDetail,
} from "./audit-adapters";

function legalRow(
  overrides: Partial<LegalDocumentAuditLogListItem> &
    Pick<LegalDocumentAuditLogListItem, "id" | "action">
): LegalDocumentAuditLogListItem {
  return {
    legalDocumentId: "doc-1",
    legalDocumentVersionId: null,
    documentType: "TERMS_OF_USE",
    versionNumber: null,
    documentHash: null,
    actorUserId: "admin-1",
    actorName: "Max Chng",
    actorEmail: "max@example.com",
    beforeJson: null,
    afterJson: null,
    reason: null,
    ipAddress: "1.1.1.1",
    userAgent: null,
    correlationId: "corr-1",
    createdAt: "2026-08-26T12:00:00.000Z",
    ...overrides,
  };
}

describe("legal document audit detail is per stored row", () => {
  it("does not copy version-upload file evidence onto Document Created", () => {
    const created = legalRow({
      id: "evt-create",
      action: "LEGAL_DOCUMENT_CREATED",
      afterJson: { title: "Terms", audience: "BOTH" },
    });
    const detail = legalAuditToAuditDetail(created);
    expect(detail.eventType).toBe("LEGAL_DOCUMENT_CREATED");
    expect(detail.eventLabel).toBe("Document Created");
    expect(detail.target?.extra?.some((field) => field.label === "File name")).toBe(false);
    expect(detail.metadata).toEqual({
      beforeJson: null,
      afterJson: { title: "Terms", audience: "BOTH" },
    });
  });

  it("keeps version upload hash and file on the Version Uploaded row", () => {
    const uploaded = legalRow({
      id: "evt-v1",
      action: "LEGAL_VERSION_UPLOADED",
      legalDocumentVersionId: "ver-1",
      versionNumber: 1,
      documentHash: "abc123",
      afterJson: { version: 1, file_name: "tnc.pdf", file_hash: "abc123", status: "DRAFT" },
    });
    const detail = legalAuditToAuditDetail(uploaded);
    expect(detail.eventType).toBe("LEGAL_VERSION_UPLOADED");
    expect(detail.target?.extra).toEqual(
      expect.arrayContaining([
        { label: "Version", value: "v1" },
        { label: "Document hash", value: "abc123" },
        { label: "File name", value: "tnc.pdf" },
      ])
    );
  });

  it("surfaces the stored archive reason without synthesizing a new event", () => {
    const archived = legalRow({
      id: "evt-arch",
      action: "LEGAL_VERSION_ARCHIVED",
      reason: "auto_archived_on_publish",
      versionNumber: 1,
    });
    const detail = legalAuditToAuditDetail(archived);
    expect(detail.eventType).toBe("LEGAL_VERSION_ARCHIVED");
    expect(detail.reason).toBe("auto_archived_on_publish");
  });
});

describe("access log detail preserves portal and requested role", () => {
  it("surfaces first-class portal and requestedRole without inventing activeRole", () => {
    const detail = accessLogToAuditDetail({
      id: "acc-1",
      user_id: "user-1",
      user: { first_name: "Ada", last_name: "Khan", email: "ada@example.com" },
      event_type: "LOGIN",
      ip_address: "1.1.1.1",
      user_agent: "jest",
      device_info: "desktop",
      success: true,
      portal: "issuer",
      source: "USER",
      correlation_id: "corr-1",
      metadata: {
        requestedRole: "ISSUER",
        roles: ["ISSUER"],
        portal: "issuer",
        stateId: "state-1",
      },
      created_at: "2026-08-27T00:00:00.000Z",
    });
    expect(detail.technical).toEqual(
      expect.arrayContaining([
        { label: "Portal", value: "issuer" },
        { label: "Requested role", value: "ISSUER" },
        { label: "OAuth state ID", value: "state-1" },
      ])
    );
    expect(JSON.stringify(detail.metadata)).not.toContain("activeRole");
  });
});

describe("productLogToAuditDetail Product Name", () => {
  it("uses the workflow snapshot and does not revive dead product_name / name keys", () => {
    const log = {
      id: "plog-1",
      user_id: "admin-1",
      user: { first_name: "Ada", last_name: "Admin", email: "ada@example.com", roles: ["ADMIN"] },
      product_id: "prod-1",
      event_type: "PRODUCT_UPDATED",
      ip_address: null,
      user_agent: null,
      device_info: null,
      metadata: {
        product_name: "Dead Key",
        name: "Also Dead",
        workflow: [{ config: { name: "Invoice Financing" } }],
      },
      created_at: "2026-08-27T00:00:00.000Z",
    } as ProductLogResponse;
    const detail = productLogToAuditDetail(log);
    expect(detail.target?.extra).toEqual(
      expect.arrayContaining([{ label: "Product", value: "Invoice Financing" }])
    );
    expect(detail.target?.extra?.some((field) => field.value === "Dead Key")).toBe(false);
  });
});

describe("notificationRelatedReference", () => {
  it("reads the same business link as notification detail", () => {
    expect(notificationRelatedReference({ noteId: "note-1", applicationId: "app-1" })).toBe("note-1");
    expect(notificationRelatedReference({ target_id: "org-1" })).toBe("org-1");
    expect(notificationRelatedReference(null)).toBeNull();
  });
});

describe("application Event Details keep DB id and display reference separate", () => {
  it("never labels the application UUID as Application Reference", () => {
    const detail = applicationLogToAuditDetail(
      {
        id: "log-1",
        event_type: "APPLICATION_SUBMITTED",
        activity: "Submitted",
        actor_id: "user-1",
        application_id: "cuid-application-uuid",
        metadata: { applicationReference: "APP-CS-2026-001" },
        ip_address: null,
        created_at: "2026-08-27T00:00:00.000Z",
        remark: null,
        entityId: null,
        review_cycle: 1,
      },
      "Application Submitted"
    );
    expect(detail.target?.applicationReference).toBe("APP-CS-2026-001");
    expect(detail.technical).toEqual(
      expect.arrayContaining([{ label: "Application ID", value: "cuid-application-uuid" }])
    );
  });

  it("omits Application Reference when historical metadata has none", () => {
    const detail = applicationLogToAuditDetail(
      {
        id: "log-2",
        event_type: "APPLICATION_SUBMITTED",
        activity: "Submitted",
        actor_id: "user-1",
        application_id: "cuid-application-uuid",
        metadata: { application_id: "cuid-application-uuid" },
        ip_address: null,
        created_at: "2026-08-27T00:00:00.000Z",
        remark: null,
        entityId: null,
        review_cycle: 1,
      },
      "Application Submitted"
    );
    expect(detail.target?.applicationReference).toBeNull();
  });
});

describe("note Event Details nested snapshots", () => {
  it("surfaces nested noteReference and beforeState/afterState previous/next", () => {
    const detail = noteEventToAuditDetail(
      {
        id: "evt-1",
        noteId: "note-1",
        eventType: "CLOSE_FUNDING",
        actorUserId: "admin-1",
        actorName: "Ada",
        actorRole: "ADMIN",
        portal: "ADMIN",
        correlationId: null,
        createdAt: "2026-08-27T00:00:00.000Z",
        metadata: {
          beforeState: { noteReference: "NT-ARF-202608-K9P", status: "PUBLISHED" },
          afterState: { noteReference: "NT-ARF-202608-K9P", status: "FUNDING" },
        },
      },
      "Funding Closed"
    );
    expect(detail.target?.noteReference).toBe("NT-ARF-202608-K9P");
    expect(detail.previousValues).toEqual({
      noteReference: "NT-ARF-202608-K9P",
      status: "PUBLISHED",
    });
    expect(detail.nextValues).toEqual({
      noteReference: "NT-ARF-202608-K9P",
      status: "FUNDING",
    });
  });
});

describe("contract activity Event Details", () => {
  it("never labels the application UUID as Application Reference", () => {
    const detail = contractEventToAuditDetail(
      {
        id: "evt-1",
        eventType: "CONTRACT_OFFER_SENT",
        createdAt: "2026-08-27T00:00:00.000Z",
        actorUserId: "user-1",
        actorName: "Ada",
        portal: "ISSUER",
        applicationId: "cuid-application-uuid",
        remark: null,
        metadata: { contract_id: "contract-1", applicationReference: "APP-CS-2026-001" },
      },
      "Facility Offer Sent"
    );
    expect(detail.target?.applicationReference).toBe("APP-CS-2026-001");
    expect(detail.technical).toEqual(
      expect.arrayContaining([{ label: "Application ID", value: "cuid-application-uuid" }])
    );

    const historical = contractEventToAuditDetail(
      {
        id: "evt-2",
        eventType: "CONTRACT_OFFER_SENT",
        createdAt: "2026-08-27T00:00:00.000Z",
        actorUserId: "user-1",
        actorName: "Ada",
        portal: "ISSUER",
        applicationId: "cuid-application-uuid",
        remark: null,
        metadata: { contract_id: "contract-1" },
      },
      "Facility Offer Sent"
    );
    expect(historical.target?.applicationReference).toBeNull();
  });
});

