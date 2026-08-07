/**
 * Dry-run-first orphan cleanup for legal-document S3 objects.
 *
 * Usage:
 *   pnpm exec tsx scripts/cleanup-legal-document-orphans.ts
 *   pnpm exec tsx scripts/cleanup-legal-document-orphans.ts --delete
 *
 * Never deletes outside legal-documents/ prefix.
 * Does not run against production unless you point env at that bucket yourself.
 */
import "dotenv/config";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client, S3_BUCKET, deleteS3Object } from "../src/lib/s3/client";
import {
  LEGAL_DOCUMENT_S3_PREFIX,
  sanitizeS3KeyForLog,
} from "../src/lib/s3/legal-document-object";
import { legalDocumentRepository } from "../src/modules/legal-documents/repository";
import { selectLegalDocumentOrphanCandidates } from "../src/modules/legal-documents/orphan-cleanup";
import { prisma } from "../src/lib/prisma";

async function listLegalDocumentKeys(): Promise<
  Array<{ key: string; lastModified: Date | null; size: number | null }>
> {
  const client = getS3Client();
  const out: Array<{ key: string; lastModified: Date | null; size: number | null }> = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: LEGAL_DOCUMENT_S3_PREFIX,
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
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
  const doDelete = process.argv.includes("--delete");
  const listed = await listLegalDocumentKeys();
  const referenced = await legalDocumentRepository.listReferencedS3Keys();
  const candidates = selectLegalDocumentOrphanCandidates({
    listedKeys: listed,
    referencedKeys: referenced,
  });

  console.log(
    JSON.stringify(
      {
        mode: doDelete ? "delete" : "dry-run",
        bucket: S3_BUCKET,
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

  let deleted = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      await deleteS3Object(candidate.key);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }
  console.log(JSON.stringify({ deleted, failed }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
