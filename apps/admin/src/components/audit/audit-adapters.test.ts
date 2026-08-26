import type { LegalDocumentAuditLogListItem } from "@cashsouk/types";
import {
  companionInitialVersionUpload,
  legalAuditToAuditDetail,
  visibleLegalDocumentAuditLogs,
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

describe("legal document create + initial version presentation", () => {
  const created = legalRow({
    id: "evt-create",
    action: "LEGAL_DOCUMENT_CREATED",
    afterJson: { title: "Terms" },
  });
  const initialUpload = legalRow({
    id: "evt-v1",
    action: "LEGAL_VERSION_UPLOADED",
    legalDocumentVersionId: "ver-1",
    versionNumber: 1,
    documentHash: "abc123",
    createdAt: "2026-08-26T12:00:01.000Z",
    afterJson: { version: 1, file_name: "tnc.pdf", file_hash: "abc123", status: "DRAFT" },
  });
  const laterUpload = legalRow({
    id: "evt-v2",
    action: "LEGAL_VERSION_UPLOADED",
    legalDocumentVersionId: "ver-2",
    versionNumber: 2,
    createdAt: "2026-08-27T12:00:00.000Z",
  });

  it("hides the same-click initial v1 upload and keeps later version uploads", () => {
    const visible = visibleLegalDocumentAuditLogs([created, initialUpload, laterUpload]);
    expect(visible.map((row) => row.id)).toEqual(["evt-create", "evt-v2"]);
  });

  it("keeps a delayed v1 upload as its own row", () => {
    const delayedV1 = {
      ...initialUpload,
      createdAt: "2026-08-26T13:00:00.000Z",
    };
    const visible = visibleLegalDocumentAuditLogs([created, delayedV1]);
    expect(visible.map((row) => row.id)).toEqual(["evt-create", "evt-v1"]);
  });

  it("puts initial v1 file evidence on the Document created detail", () => {
    const detail = legalAuditToAuditDetail(
      created,
      companionInitialVersionUpload(created, [created, initialUpload])
    );
    expect(detail.eventLabel).toBe("Document created");
    expect(detail.target?.extra).toEqual(
      expect.arrayContaining([
        { label: "Initial version", value: "v1" },
        { label: "File name", value: "tnc.pdf" },
        { label: "File hash", value: "abc123" },
        { label: "Initial status", value: "DRAFT" },
      ])
    );
    expect(detail.technical).toEqual(
      expect.arrayContaining([{ label: "Initial version event ID", value: "evt-v1" }])
    );
  });
});
