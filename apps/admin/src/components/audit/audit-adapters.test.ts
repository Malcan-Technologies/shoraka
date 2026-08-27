import type { LegalDocumentAuditLogListItem, ProductLogResponse } from "@cashsouk/types";
import {
  accessLogToAuditDetail,
  applicationLogToAuditDetail,
  contractEventToAuditDetail,
  legalAuditToAuditDetail,
  noteEventToAuditDetail,
  notificationRelatedReference,
  organizationLogToAuditDetail,
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

describe("occupancy Event Details display references", () => {
  it("surfaces contract and invoice references without treating the UUID as Application Reference", () => {
    const detail = applicationLogToAuditDetail(
      {
        id: "log-occ",
        event_type: "CONTRACT_FACILITY_OCCUPANCY_UPDATED",
        activity: "Occupancy updated",
        actor_id: "user-1",
        application_id: "cuid-application-uuid",
        metadata: {
          contract_id: "contract-cuid",
          applicationReference: "APP-CS-2026-001",
          contractReference: "FAC-ARF-202608-A1Z",
          invoiceReference: "INV-ARF-202608-B2Y",
        },
        ip_address: null,
        created_at: "2026-08-27T00:00:00.000Z",
        remark: null,
        entityId: "contract-cuid",
        review_cycle: null,
      },
      "Facility Occupancy Updated"
    );
    expect(detail.target?.applicationReference).toBe("APP-CS-2026-001");
    expect(detail.target?.contractReference).toBe("FAC-ARF-202608-A1Z");
    expect(detail.target?.invoiceReference).toBe("INV-ARF-202608-B2Y");
    expect(detail.technical).toEqual(
      expect.arrayContaining([{ label: "Application ID", value: "cuid-application-uuid" }])
    );
  });

  it("omits new reference labels when historical occupancy metadata has none", () => {
    const detail = applicationLogToAuditDetail(
      {
        id: "log-occ-old",
        event_type: "CONTRACT_FACILITY_OCCUPANCY_UPDATED",
        activity: "Occupancy updated",
        actor_id: "user-1",
        application_id: "cuid-application-uuid",
        metadata: { contract_id: "contract-cuid", before: { utilized_facility: 0 }, after: { utilized_facility: 1 } },
        ip_address: null,
        created_at: "2026-08-27T00:00:00.000Z",
        remark: null,
        entityId: "contract-cuid",
        review_cycle: null,
      },
      "Facility Occupancy Updated"
    );
    expect(detail.target?.applicationReference).toBeNull();
    expect(detail.target?.contractReference).toBeNull();
    expect(detail.target?.invoiceReference).toBeNull();
    expect(detail.previousValues).toEqual({ utilized_facility: 0 });
    expect(detail.nextValues).toEqual({ utilized_facility: 1 });
  });
});

describe("withdrawal letter and Shoraka Event Details", () => {
  it("keeps withdrawalReference independent of later live-row changes", () => {
    const detail = noteEventToAuditDetail(
      {
        id: "evt-wdl",
        noteId: "note-1",
        eventType: "WITHDRAWAL_LETTER_GENERATED",
        actorUserId: "admin-1",
        actorName: "Ada",
        actorRole: "ADMIN",
        portal: "ADMIN",
        correlationId: null,
        createdAt: "2026-08-27T00:00:00.000Z",
        targetType: "WITHDRAWAL",
        targetId: "wdl-internal-id",
        metadata: {
          withdrawalId: "wdl-internal-id",
          withdrawalReference: "WDL-ARF-202608-A1Z",
          s3Key: "withdrawal-letters/wdl-internal-id/trustee-WDL-ARF-202608-A1Z.pdf",
        },
      },
      "Withdrawal letter generated"
    );
    expect(detail.target?.id).toBe("wdl-internal-id");
    expect(detail.target?.withdrawalReference).toBe("WDL-ARF-202608-A1Z");
  });

  it("labels provider_order_id as Provider order ID, not the internal trade-order target", () => {
    const detail = noteEventToAuditDetail(
      {
        id: "evt-shoraka",
        noteId: "note-1",
        eventType: "SHORAKA_ORDER_SUBMITTED",
        actorUserId: null,
        actorName: null,
        actorRole: null,
        portal: null,
        correlationId: null,
        createdAt: "2026-08-27T00:00:00.000Z",
        targetType: "SHORAKA_ORDER",
        targetId: "trade-order-cuid",
        metadata: {
          trade_order_id: "trade-order-cuid",
          provider_order_id: "provider-order-abc",
        },
      },
      "Tawarruq Order Submitted"
    );
    expect(detail.target?.id).toBe("trade-order-cuid");
    expect(detail.target?.id).not.toBe("provider-order-abc");
    expect(detail.technical).toEqual(
      expect.arrayContaining([{ label: "Provider order ID", value: "provider-order-abc" }])
    );
    expect(detail.target?.extra?.some((field) => field.value === "provider-order-abc")).toBe(false);
  });
});

describe("MEMBER_* Event Details", () => {
  it("surfaces organisation reference and membership fields without security role labels", () => {
    const detail = organizationLogToAuditDetail(
      {
        id: "log-member",
        user_id: "member-1",
        user: { first_name: "Ada", last_name: "Khan", email: "ada@example.com", roles: ["ISSUER"] },
        role: "ISSUER",
        event_type: "MEMBER_ADDED",
        portal: "issuer",
        ip_address: null,
        user_agent: null,
        device_info: null,
        device_type: null,
        metadata: {
          action: "MEMBER_ADDED",
          organizationId: "org-cuid",
          organizationReference: "ISS-202608-DK3",
          memberUserId: "member-1",
          memberEmail: "member@example.com",
          newRole: "ORGANIZATION_MEMBER",
        },
        created_at: "2026-08-27T00:00:00.000Z",
        organizationName: "ABC Trading",
      },
      "Member Added"
    );
    expect(detail.eventLabel).toBe("Member Added");
    expect(detail.eventType).toBe("MEMBER_ADDED");
    expect(detail.target?.organizationReference).toBe("ISS-202608-DK3");
    expect(detail.target?.extra).toEqual(
      expect.arrayContaining([
        { label: "Member email", value: "member@example.com" },
        { label: "New role", value: "ORGANIZATION_MEMBER" },
      ])
    );
  });
});

