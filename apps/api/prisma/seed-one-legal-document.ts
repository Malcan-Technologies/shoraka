import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { LegalDocumentAudience, LegalDocumentType, LegalDocumentVersionStatus } from "@prisma/client";

// Ensure we always load the repo root `.env`, even if the script is executed from elsewhere.
// (The prisma datasource uses `env("DATABASE_URL")`.)
const repoRootEnvPath = path.resolve(__dirname, "../../../.env");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: repoRootEnvPath, override: false });

function parseArg(name: string, defaultValue: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  if (!found) return defaultValue;
  return found.slice(prefix.length);
}

async function main() {
  const prisma = new PrismaClient();

  const type = parseArg("type", "PDPA_NOTICE_AND_CONSENT") as LegalDocumentType;
  const title = parseArg("title", `Seed legal doc: ${type}`);
  const versionNumber = Number(parseArg("version", "1"));
  const status = parseArg("status", "PUBLISHED") as LegalDocumentVersionStatus;
  const audience = parseArg("audience", "BOTH") as LegalDocumentAudience;

  const uploadedBy = parseArg("uploadedBy", "seed_admin");

  // 1) Ensure the logical legal document definition exists (platform-level; `type` is unique).
  const legalDocument = await prisma.legalDocument.upsert({
    where: { type },
    update: {
      title,
      audience,
      required_for_onboarding: true,
      public_visibility: false,
      show_in_account: true,
    },
    create: {
      type,
      title,
      audience,
      required_for_onboarding: true,
      public_visibility: false,
      show_in_account: true,
    },
  });

  const s3Key = `seed/legal-documents/${type}/v${versionNumber}.pdf`;
  const fileName = `${type}-v${versionNumber}.pdf`;
  const fileSize = 1234;
  const fileHash = "seed_sha256_dummy_hash_000000000000000000000000000000000000000000000000000000";

  // If we want the version to be PUBLISHED, archive any existing published versions for the same document.
  // This avoids violating the DB rule: "at most one PUBLISHED per legal_document_id".
  if (status === LegalDocumentVersionStatus.PUBLISHED) {
    await prisma.legalDocumentVersion.updateMany({
      where: {
        legal_document_id: legalDocument.id,
        status: LegalDocumentVersionStatus.PUBLISHED,
        NOT: {
          s3_key: s3Key,
        },
      },
      data: {
        status: LegalDocumentVersionStatus.ARCHIVED,
        archived_by: uploadedBy,
        archived_at: new Date(),
      },
    });
  }

  // 2) Ensure the specific version exists (unique per (legal_document_id, version)).
  const existingVersion = await prisma.legalDocumentVersion.findFirst({
    where: { legal_document_id: legalDocument.id, version: versionNumber },
  });

  const version = existingVersion
    ? await prisma.legalDocumentVersion.update({
        where: { id: existingVersion.id },
        data: {
          status,
          s3_key: s3Key,
          file_name: fileName,
          content_type: "application/pdf",
          file_size: fileSize,
          file_hash: fileHash,
          reacceptance_required: false,
          uploaded_by: uploadedBy,
        },
      })
    : await prisma.legalDocumentVersion.create({
        data: {
          legal_document_id: legalDocument.id,
          version: versionNumber,
          status,
          s3_key: s3Key,
          file_name: fileName,
          content_type: "application/pdf",
          file_size: fileSize,
          file_hash: fileHash,
          reacceptance_required: false,
          uploaded_by: uploadedBy,
          published_by: status === LegalDocumentVersionStatus.PUBLISHED ? uploadedBy : null,
          published_at: status === LegalDocumentVersionStatus.PUBLISHED ? new Date() : null,
        },
      });

  console.log(
    JSON.stringify(
      {
        legalDocument: { id: legalDocument.id, type: legalDocument.type, title: legalDocument.title },
        version: { id: version.id, version: version.version, status: version.status, s3_key: version.s3_key },
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  // Keep errors readable for local scripting.
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

