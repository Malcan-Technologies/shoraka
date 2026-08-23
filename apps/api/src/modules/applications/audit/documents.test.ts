import fs from "node:fs";
import path from "node:path";
import { diffAcceptanceDocuments, diffSupportingDocuments } from "./documents";

describe("application document audit diffs", () => {
  it("detects supporting document upload, replace, and remove", () => {
    const previous = {
      categories: [
        {
          category_key: "kyc",
          documents: [
            {
              title: "NRIC",
              workflow_document_index: 0,
              file: { file_name: "old.pdf", file_size: 10, s3_key: "a/old.pdf" },
            },
            {
              title: "SSM",
              workflow_document_index: 1,
              file: { file_name: "ssm.pdf", file_size: 20, s3_key: "a/ssm.pdf" },
            },
          ],
        },
      ],
    };
    const next = {
      categories: [
        {
          category_key: "kyc",
          documents: [
            {
              title: "NRIC",
              workflow_document_index: 0,
              file: { file_name: "new.pdf", file_size: 30, s3_key: "a/new.pdf" },
            },
            {
              title: "Bank",
              workflow_document_index: 2,
              file: { file_name: "bank.pdf", file_size: 40, s3_key: "a/bank.pdf" },
            },
          ],
        },
      ],
    };

    const changes = diffSupportingDocuments(previous, next);
    expect(changes.map((c) => c.eventType).sort()).toEqual([
      "APPLICATION_DOCUMENT_REMOVED",
      "APPLICATION_DOCUMENT_REPLACED",
      "APPLICATION_DOCUMENT_UPLOADED",
    ]);
    expect(changes.find((c) => c.eventType === "APPLICATION_DOCUMENT_REPLACED")?.documentCategory).toBe(
      "kyc"
    );
    expect(changes.every((c) => !("s3Key" in c))).toBe(true);
  });

  it("treats board resolution as a generic acceptance-document slot", () => {
    const previous = { documents: [] };
    const next = {
      documents: [
        {
          title: "Board Resolution",
          workflow_document_index: 1,
          file: { file_name: "board.pdf", file_size: 12, s3_key: "acc/board.pdf" },
        },
      ],
    };
    const changes = diffAcceptanceDocuments(previous, next);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      eventType: "APPLICATION_DOCUMENT_UPLOADED",
      documentCategory: "acceptance_documents",
      slotName: "1",
      fileName: "board.pdf",
      fileSizeBytes: 12,
    });
  });
});

describe("application document S3/DB failure truthfulness", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../service.ts"),
    "utf8"
  );

  it("uploads live outside the DB transaction; JSON+audit share a short tx; old S3 cleanup is after commit", () => {
    const start = service.indexOf('if (fieldName === "supporting_documents")');
    const nextBusiness = service.indexOf('if (fieldName === "business_details")', start);
    const supporting = service.slice(start, nextBusiness);
    expect(supporting).toMatch(/prisma\.\$transaction/);
    expect(supporting).toMatch(/writeApplicationDocumentAuditLogs/);
    const txEnd = supporting.indexOf("return row;");
    const cleanupIdx = supporting.indexOf("deleteOrphanS3Keys(removedKeys)");
    expect(cleanupIdx).toBeGreaterThan(txEnd);
    expect(supporting).toMatch(/catch \(err\)/);
    expect(supporting).toMatch(/deleteOrphanS3Keys\(newKeys\)/);
  });

  it("rolls back JSON state and audit together, then best-effort deletes newly uploaded S3 keys", () => {
    expect(service).toMatch(/writeApplicationDocumentAuditLogs\(id, auditContext, changes, tx\)/);
    expect(service).toMatch(/await this.deleteOrphanS3Keys\(newKeys\)/);
  });
});
