import { AppError } from "../../lib/http/error-handler";
import {
  isAcceptanceDocumentItemId,
  parseAcceptanceDocumentItemIndex,
} from "@cashsouk/types";

export type AcceptanceReviewItemRow = {
  item_type: string;
  item_id: string;
  status: string;
};

/** Indices flagged for issuer replacement when offer phase is CHANGES_REQUESTED. */
export function collectFlaggedAcceptanceDocumentIndices(
  reviewItems: AcceptanceReviewItemRow[] | null | undefined
): Set<number> {
  const indices = new Set<number>();
  for (const item of reviewItems ?? []) {
    if (item.item_type !== "document" || item.status !== "AMENDMENT_REQUESTED") continue;
    if (!isAcceptanceDocumentItemId(item.item_id)) continue;
    const idx = parseAcceptanceDocumentItemIndex(item.item_id);
    if (idx !== null) indices.add(idx);
  }
  return indices;
}

function extractS3KeysFromAcceptanceSlot(doc: Record<string, unknown>): string[] {
  const keys: string[] = [];
  const file = doc.file as Record<string, unknown> | undefined;
  if (typeof file?.s3_key === "string" && file.s3_key) keys.push(file.s3_key);
  const files = doc.files;
  if (Array.isArray(files)) {
    for (const f of files) {
      const key = (f as Record<string, unknown>)?.s3_key;
      if (typeof key === "string" && key) keys.push(key);
    }
  }
  return keys;
}

/** Per workflow_document_index fingerprint (sorted S3 keys) for change detection. */
export function acceptanceDocumentSlotFingerprints(data: unknown): Map<number, string> {
  const map = new Map<number, string>();
  if (!data || typeof data !== "object") return map;
  const root = data as Record<string, unknown>;
  const docs = Array.isArray(root.documents) ? root.documents : Array.isArray(data) ? data : [];
  docs.forEach((doc, listIndex) => {
    const record = doc as Record<string, unknown>;
    const idx =
      typeof record.workflow_document_index === "number"
        ? record.workflow_document_index
        : listIndex;
    const keys = extractS3KeysFromAcceptanceSlot(record).sort();
    map.set(idx, keys.join("|"));
  });
  return map;
}

export function findChangedAcceptanceDocumentIndices(before: unknown, after: unknown): number[] {
  const beforeFp = acceptanceDocumentSlotFingerprints(before);
  const afterFp = acceptanceDocumentSlotFingerprints(after);
  const allIndices = new Set([...beforeFp.keys(), ...afterFp.keys()]);
  const changed: number[] = [];
  for (const idx of allIndices) {
    if ((beforeFp.get(idx) ?? "") !== (afterFp.get(idx) ?? "")) {
      changed.push(idx);
    }
  }
  return changed;
}

export function findAcceptanceDocumentIndexForS3Key(data: unknown, s3Key: string): number | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const docs = Array.isArray(root.documents) ? root.documents : Array.isArray(data) ? data : [];
  for (let listIndex = 0; listIndex < docs.length; listIndex++) {
    const record = docs[listIndex] as Record<string, unknown>;
    const idx =
      typeof record.workflow_document_index === "number"
        ? record.workflow_document_index
        : listIndex;
    if (extractS3KeysFromAcceptanceSlot(record).includes(s3Key)) {
      return idx;
    }
  }
  return null;
}

export function assertAcceptanceDocumentIndexEditableInChangesRequested(
  acceptanceDocIndex: number,
  flaggedIndices: Set<number>
): void {
  if (flaggedIndices.has(acceptanceDocIndex)) return;
  throw new AppError(
    403,
    "EDIT_NOT_ALLOWED",
    "This acceptance document cannot be edited until CashSouk requests a change on it"
  );
}
