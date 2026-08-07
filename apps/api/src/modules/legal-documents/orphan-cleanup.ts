import {
  isLegalDocumentS3Key,
  LEGAL_DOCUMENT_S3_PREFIX,
} from "../../lib/s3/legal-document-object";

export const DEFAULT_LEGAL_ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type OrphanCandidate = {
  key: string;
  lastModified: Date | null;
  size: number | null;
};

/**
 * Fail closed if the LegalDocument prefix is missing or unsafe.
 */
export function assertLegalDocumentCleanupPrefix(prefix: string = LEGAL_DOCUMENT_S3_PREFIX): string {
  const normalized = prefix.trim();
  if (!normalized) {
    throw new Error("LEGAL_DOCUMENT_CLEANUP_PREFIX_INVALID: prefix is empty");
  }
  if (normalized.includes("..")) {
    throw new Error("LEGAL_DOCUMENT_CLEANUP_PREFIX_INVALID: prefix contains ..");
  }
  if (normalized.startsWith("/") || normalized.includes("://")) {
    throw new Error("LEGAL_DOCUMENT_CLEANUP_PREFIX_INVALID: prefix must be a relative S3 key prefix");
  }
  if (!normalized.endsWith("/")) {
    throw new Error("LEGAL_DOCUMENT_CLEANUP_PREFIX_INVALID: prefix must end with /");
  }
  if (normalized !== LEGAL_DOCUMENT_S3_PREFIX) {
    throw new Error(
      `LEGAL_DOCUMENT_CLEANUP_PREFIX_INVALID: expected ${LEGAL_DOCUMENT_S3_PREFIX}`
    );
  }
  return normalized;
}

/**
 * Select unreferenced legal-document S3 keys older than retention.
 * Pure function for unit tests — does not call S3.
 *
 * Algorithm (exact string equality on full keys):
 * 1. Skip keys that fail isLegalDocumentS3Key / prefix checks.
 * 2. Skip keys present in referencedKeys Set (exact match).
 * 3. Skip keys with missing LastModified (fail closed for age).
 * 4. Skip keys younger than minAgeMs.
 * 5. Remaining keys are orphan candidates.
 */
export function selectLegalDocumentOrphanCandidates(params: {
  listedKeys: Array<{ key: string; lastModified?: Date | null; size?: number | null }>;
  referencedKeys: Iterable<string>;
  now?: Date;
  minAgeMs?: number;
  prefix?: string;
}): OrphanCandidate[] {
  const prefix = assertLegalDocumentCleanupPrefix(params.prefix ?? LEGAL_DOCUMENT_S3_PREFIX);
  const now = params.now ?? new Date();
  const minAgeMs = params.minAgeMs ?? DEFAULT_LEGAL_ORPHAN_MIN_AGE_MS;
  const referenced = new Set(params.referencedKeys);

  const candidates: OrphanCandidate[] = [];
  for (const item of params.listedKeys) {
    if (!item.key) continue;
    if (!isLegalDocumentS3Key(item.key)) continue;
    if (!item.key.startsWith(prefix)) continue;
    if (referenced.has(item.key)) continue;

    const modified = item.lastModified ?? null;
    // Missing LastModified cannot prove age — skip (do not delete).
    if (!modified) continue;
    if (now.getTime() - modified.getTime() < minAgeMs) continue;

    candidates.push({
      key: item.key,
      lastModified: modified,
      size: item.size ?? null,
    });
  }
  return candidates;
}

export type DeleteOrphanResult = {
  deleted: number;
  failed: number;
  skippedReferenced: number;
  skippedInvalidPrefix: number;
};

/**
 * Delete orphan candidates one-by-one with a fresh reference check before each delete.
 */
export async function deleteLegalDocumentOrphanCandidates(params: {
  candidates: OrphanCandidate[];
  isReferenced: (key: string) => Promise<boolean>;
  deleteObject: (key: string) => Promise<void>;
  prefix?: string;
}): Promise<DeleteOrphanResult> {
  const prefix = assertLegalDocumentCleanupPrefix(params.prefix ?? LEGAL_DOCUMENT_S3_PREFIX);
  let deleted = 0;
  let failed = 0;
  let skippedReferenced = 0;
  let skippedInvalidPrefix = 0;

  for (const candidate of params.candidates) {
    if (!isLegalDocumentS3Key(candidate.key) || !candidate.key.startsWith(prefix)) {
      skippedInvalidPrefix += 1;
      continue;
    }

    try {
      const referenced = await params.isReferenced(candidate.key);
      if (referenced) {
        skippedReferenced += 1;
        continue;
      }
      await params.deleteObject(candidate.key);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return { deleted, failed, skippedReferenced, skippedInvalidPrefix };
}

export function parseCleanupCliArgs(argv: string[]): {
  doDelete: boolean;
  confirmProduction: boolean;
  minAgeHours: number | null;
} {
  // Only the exact token --delete enables deletion (not --delete=true, --delete-all, etc.).
  const doDelete = argv.includes("--delete");
  const confirmProduction = argv.includes("--confirm-production");
  let minAgeHours: number | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--min-age-hours=")) {
      const raw = Number(arg.slice("--min-age-hours=".length));
      if (!Number.isFinite(raw) || raw < 0) {
        throw new Error("Invalid --min-age-hours value");
      }
      minAgeHours = raw;
    }
  }
  return { doDelete, confirmProduction, minAgeHours };
}

export function assertDestructiveCleanupAllowed(params: {
  doDelete: boolean;
  confirmProduction: boolean;
  nodeEnv: string | undefined;
  bucket: string;
}): void {
  if (!params.doDelete) return;

  const env = (params.nodeEnv || "").toLowerCase();
  const bucket = params.bucket.toLowerCase();
  const looksProduction =
    env === "production" || bucket.includes("prod") || bucket.includes("production");

  if (looksProduction && !params.confirmProduction) {
    throw new Error(
      "Refusing --delete against a production-like environment/bucket without --confirm-production"
    );
  }
}
