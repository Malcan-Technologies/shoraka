import {
  isLegalDocumentS3Key,
  LEGAL_DOCUMENT_S3_PREFIX,
} from "../../lib/s3/legal-document-object";

export type OrphanCandidate = {
  key: string;
  lastModified: Date | null;
  size: number | null;
};

/**
 * Select unreferenced legal-document S3 keys older than retention.
 * Pure function for unit tests — does not call S3.
 */
export function selectLegalDocumentOrphanCandidates(params: {
  listedKeys: Array<{ key: string; lastModified?: Date | null; size?: number | null }>;
  referencedKeys: Iterable<string>;
  now?: Date;
  minAgeMs?: number;
}): OrphanCandidate[] {
  const now = params.now ?? new Date();
  const minAgeMs = params.minAgeMs ?? 24 * 60 * 60 * 1000;
  const referenced = new Set(params.referencedKeys);

  const candidates: OrphanCandidate[] = [];
  for (const item of params.listedKeys) {
    if (!isLegalDocumentS3Key(item.key)) continue;
    if (!item.key.startsWith(LEGAL_DOCUMENT_S3_PREFIX)) continue;
    if (referenced.has(item.key)) continue;

    const modified = item.lastModified ?? null;
    if (modified && now.getTime() - modified.getTime() < minAgeMs) continue;

    candidates.push({
      key: item.key,
      lastModified: modified,
      size: item.size ?? null,
    });
  }
  return candidates;
}
