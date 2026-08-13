/**
 * Dry-run-first orphan cleanup for legal-document S3 objects.
 *
 * Usage:
 *   pnpm exec tsx scripts/cleanup-legal-document-orphans.ts
 *   pnpm exec tsx scripts/cleanup-legal-document-orphans.ts --delete
 *   pnpm exec tsx scripts/cleanup-legal-document-orphans.ts --delete --confirm-production
 *
 * Never deletes outside legal-documents/ prefix.
 * Destructive mode requires explicit --delete (and --confirm-production for prod-like envs).
 */
import "dotenv/config";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client, S3_BUCKET, deleteS3Object } from "../src/lib/s3/client";
import {
  LEGAL_DOCUMENT_S3_PREFIX,
  sanitizeS3KeyForLog,
} from "../src/lib/s3/legal-document-object";
import { legalDocumentRepository } from "../src/modules/legal-documents/repository";
import {
  assertDestructiveCleanupAllowed,
  assertLegalDocumentCleanupPrefix,
  DEFAULT_LEGAL_ORPHAN_MIN_AGE_MS,
  deleteLegalDocumentOrphanCandidates,
  parseCleanupCliArgs,
  selectLegalDocumentOrphanCandidates,
} from "../src/modules/legal-documents/orphan-cleanup";
import { prisma } from "../src/lib/prisma";

async function listLegalDocumentKeys(prefix: string): Promise<
  Array<{ key: string; lastModified: Date | null; size: number | null }>
> {
  const client = getS3Client();
  const out: Array<{ key: string; lastModified: Date | null; size: number | null }> = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      // Skip "folder" placeholders.
      if (obj.Key.endsWith("/")) continue;
      out.push({
        key: obj.Key,
        lastModified: obj.LastModified ?? null,
        size: typeof obj.Size === "number" ? obj.Size : null,
      });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

async function main() {
  const { doDelete, confirmProduction, minAgeHours } = parseCleanupCliArgs(process.argv);
  const prefix = assertLegalDocumentCleanupPrefix(LEGAL_DOCUMENT_S3_PREFIX);
  const minAgeMs =
    minAgeHours === null ? DEFAULT_LEGAL_ORPHAN_MIN_AGE_MS : minAgeHours * 60 * 60 * 1000;

  assertDestructiveCleanupAllowed({
    doDelete,
    confirmProduction,
    nodeEnv: process.env.NODE_ENV,
    bucket: S3_BUCKET,
  });

  let listed;
  let referenced;
  try {
    listed = await listLegalDocumentKeys(prefix);
    referenced = await legalDocumentRepository.listReferencedS3Keys();
  } catch (error) {
    console.error(
      JSON.stringify({
        error: "LIST_OR_DB_FAILED",
        message: error instanceof Error ? error.message : "unknown",
        deleted: 0,
      })
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const candidates = selectLegalDocumentOrphanCandidates({
    listedKeys: listed,
    referencedKeys: referenced,
    minAgeMs,
    prefix,
  });

  console.log(
    JSON.stringify(
      {
        mode: doDelete ? "delete" : "dry-run",
        bucket: S3_BUCKET,
        prefix,
        minAgeHours: minAgeMs / (60 * 60 * 1000),
        listedCount: listed.length,
        referencedCount: referenced.length,
        candidateCount: candidates.length,
        candidatePreviews: candidates.slice(0, 20).map((c) => sanitizeS3KeyForLog(c.key)),
      },
      null,
      2
    )
  );

  if (!doDelete) {
    console.log("Dry run only. Pass --delete to remove candidates.");
    await prisma.$disconnect();
    return;
  }

  const result = await deleteLegalDocumentOrphanCandidates({
    candidates,
    prefix,
    isReferenced: async (key) => {
      const count = await legalDocumentRepository.countVersionsByS3Key(key);
      return count > 0;
    },
    deleteObject: async (key) => {
      await deleteS3Object(key);
    },
  });

  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
