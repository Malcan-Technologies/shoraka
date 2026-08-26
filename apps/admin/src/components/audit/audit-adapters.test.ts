import type { LegalDocumentAuditLogListItem } from "@cashsouk/types";
import { accessLogToAuditDetail, legalAuditToAuditDetail } from "./audit-adapters";

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
