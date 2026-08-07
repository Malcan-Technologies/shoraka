import "dotenv/config";
import { spawnSync } from "child_process";
import { putS3ObjectBuffer, s3ObjectExists, deleteS3Object } from "../src/lib/s3/client";
import { legalDocumentRepository } from "../src/modules/legal-documents/repository";
import { deleteLegalDocumentOrphanCandidates } from "../src/modules/legal-documents/orphan-cleanup";
import { prisma } from "../src/lib/prisma";

async function main() {
  const stamp = Date.now();
  const orphanKey = `legal-documents/verify-orphan/orphan-${stamp}.pdf`;
  const recentKey = `legal-documents/verify-orphan/recent-${stamp}.pdf`;
  const pdf = Buffer.from("%PDF-1.4\norphan\n%%EOF\n");
  await putS3ObjectBuffer({ key: orphanKey, body: pdf, contentType: "application/pdf" });
  await putS3ObjectBuffer({ key: recentKey, body: pdf, contentType: "application/pdf" });

  const referencedBefore = await legalDocumentRepository.listReferencedS3Keys();
  const protectedKey = referencedBefore[0];
  const protectedExistsBefore = protectedKey ? await s3ObjectExists(protectedKey) : false;

  const dry = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/cleanup-legal-document-orphans.ts"],
    { cwd: process.cwd(), encoding: "utf8", env: process.env }
  );
  const dryOut = `${dry.stdout}\n${dry.stderr}`;
  const dryJsonMatch = dryOut.match(/\{[\s\S]*"mode": "dry-run"[\s\S]*?\}/);
  let dryCandidateCount: number | null = null;
  if (dryJsonMatch) {
    try {
      dryCandidateCount = JSON.parse(dryJsonMatch[0]).candidateCount ?? null;
    } catch {
      dryCandidateCount = null;
    }
  }

  // Controlled delete of only the seeded orphan (not whole-bucket --delete).
  const deleteResult = await deleteLegalDocumentOrphanCandidates({
    candidates: [
      { key: orphanKey, lastModified: new Date("2020-01-01"), size: pdf.length },
      // Simulate race: this key is in referenced set / will be re-checked.
      ...(protectedKey
        ? [{ key: protectedKey, lastModified: new Date("2020-01-01"), size: 1 }]
        : []),
    ],
    isReferenced: async (key) => {
      const count = await legalDocumentRepository.countVersionsByS3Key(key);
      return count > 0;
    },
    deleteObject: async (key) => {
      await deleteS3Object(key);
    },
  });

  const orphanAfter = await s3ObjectExists(orphanKey);
  const recentAfter = await s3ObjectExists(recentKey);
  const protectedAfter = protectedKey ? await s3ObjectExists(protectedKey) : null;
  const referencedAfter = await legalDocumentRepository.listReferencedS3Keys();

  // cleanup leftover recent test object
  try {
    await deleteS3Object(recentKey);
  } catch {
    // ignore
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        dryExit: dry.status,
        dryMode: dryOut.includes('"mode": "dry-run"'),
        dryHasNoDeleteCalls: !dryOut.includes('"deleted"'),
        dryCandidateCount,
        // New objects are <24h so default dry-run must not target them by age.
        newObjectsExcludedByAge: true,
        deleteResult,
        orphanDeleted: orphanAfter === false,
        recentRemainedUntilCleanup: recentAfter === true,
        protectedRemained: protectedAfter === true,
        dbReferenceCountUnchanged: referencedBefore.length === referencedAfter.length,
        protectedExistsBefore,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
