import { parseLegalAdminAuditMetadata } from "./metadata";

describe("legal admin audit metadata validation", () => {
  it("accepts LEGAL_DOCUMENT_CREATED fields", () => {
    const parsed = parseLegalAdminAuditMetadata("LEGAL_DOCUMENT_CREATED", {
      actorName: "Ada Admin",
      actorEmail: "ada@example.com",
      documentType: "TERMS_OF_USE",
      title: "Terms",
      audience: "BOTH",
      requiredForOnboarding: true,
      publicVisibility: false,
      showInAccount: false,
    });
    expect(parsed.documentType).toBe("TERMS_OF_USE");
  });

  it("rejects LEGAL_DOCUMENT_UPDATED without changedFields", () => {
    expect(() =>
      parseLegalAdminAuditMetadata("LEGAL_DOCUMENT_UPDATED", {
        actorName: "Ada Admin",
        actorEmail: "ada@example.com",
        documentType: "TERMS_OF_USE",
        changedFields: [],
        before: {},
        after: {},
      })
    ).toThrow();
  });

  it("requires restoredAs for LEGAL_DOCUMENT_VERSION_RESTORED", () => {
    expect(() =>
      parseLegalAdminAuditMetadata("LEGAL_DOCUMENT_VERSION_RESTORED", {
        actorName: null,
        actorEmail: null,
        documentType: "TERMS_OF_USE",
        versionId: "v1",
        versionNumber: 1,
        fileName: "a.pdf",
        fileHash: "abc",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
        previousStatus: "ARCHIVED",
        newStatus: "DRAFT",
      })
    ).toThrow();
  });

  it("accepts LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION metadata", () => {
    const parsed = parseLegalAdminAuditMetadata("LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION", {
      actorName: "Ada Admin",
      actorEmail: "ada@example.com",
      documentType: "TERMS_OF_USE",
      sourceVersionId: "v1",
      sourceVersionNumber: 1,
      newVersionId: "v3",
      newVersionNumber: 3,
      fileName: "a.pdf",
      fileHash: "abc",
      mimeType: "application/pdf",
      fileSizeBytes: 10,
      status: "DRAFT",
    });
    expect(parsed.newVersionId).toBe("v3");
    expect(parsed.sourceVersionId).toBe("v1");

    const withSourceStatus = parseLegalAdminAuditMetadata(
      "LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION",
      {
        actorName: "Ada Admin",
        actorEmail: "ada@example.com",
        documentType: "TERMS_OF_USE",
        sourceVersionId: "v1",
        sourceVersionNumber: 1,
        newVersionId: "v3",
        newVersionNumber: 3,
        fileName: "a.pdf",
        fileHash: "abc",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
        status: "DRAFT",
        sourceVersionStatus: "PUBLISHED",
      }
    );
    expect(withSourceStatus.sourceVersionStatus).toBe("PUBLISHED");
  });
});
