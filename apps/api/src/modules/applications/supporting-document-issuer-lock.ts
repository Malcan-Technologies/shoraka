import { AppError } from "../../lib/http/error-handler";
import {
  supportingDocCategoryKeyFromLabel,
  supportingDocScopeKeyMatchesRow,
  unwrapSupportingDocumentCategories,
} from "@cashsouk/types";

export type SupportingDocumentSlot = {
  categoryKey: string;
  documentIndex: number;
};

const SUPPORTING_DOC_ITEM_PREFIX = "supporting_documents:";

function extractS3KeysFromSupportingSlot(doc: Record<string, unknown>): string[] {
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function categoryKeyForSlot(name: string, categoryIndex: number): string {
  const fromLabel = supportingDocCategoryKeyFromLabel(name);
  if (fromLabel) return fromLabel;
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase() || `cat_${categoryIndex}`;
}

function slotId(categoryKey: string, documentIndex: number): string {
  return `${categoryKey}:${documentIndex}`;
}

function parseSlotId(id: string): SupportingDocumentSlot | null {
  const sep = id.lastIndexOf(":");
  if (sep <= 0) return null;
  const categoryKey = id.slice(0, sep);
  const documentIndex = Number(id.slice(sep + 1));
  if (!categoryKey || !Number.isInteger(documentIndex) || documentIndex < 0) return null;
  return { categoryKey, documentIndex };
}

function visitSupportingDocumentSlots(
  data: unknown,
  visit: (slot: SupportingDocumentSlot, record: Record<string, unknown>) => void
): void {
  const categories = unwrapSupportingDocumentCategories(data);
  categories.forEach((category, categoryIndex) => {
    const categoryKey = categoryKeyForSlot(category.name, categoryIndex);
    category.documents.forEach((doc, listIndex) => {
      const record = asRecord(doc) ?? {};
      const documentIndex =
        typeof record.workflow_document_index === "number"
          ? record.workflow_document_index
          : listIndex;
      visit({ categoryKey, documentIndex }, record);
    });
  });
}

/** Per category + workflow_document_index fingerprint (sorted S3 keys) for change detection. */
export function supportingDocumentSlotFingerprints(data: unknown): Map<string, string> {
  const map = new Map<string, string>();
  visitSupportingDocumentSlots(data, (slot, record) => {
    const keys = extractS3KeysFromSupportingSlot(record).sort();
    map.set(slotId(slot.categoryKey, slot.documentIndex), keys.join("|"));
  });
  return map;
}

export function findChangedSupportingDocumentSlots(
  before: unknown,
  after: unknown
): SupportingDocumentSlot[] {
  const beforeFp = supportingDocumentSlotFingerprints(before);
  const afterFp = supportingDocumentSlotFingerprints(after);
  const allIds = new Set([...beforeFp.keys(), ...afterFp.keys()]);
  const changed: SupportingDocumentSlot[] = [];
  for (const id of allIds) {
    if ((beforeFp.get(id) ?? "") === (afterFp.get(id) ?? "")) continue;
    const slot = parseSlotId(id);
    if (slot) changed.push(slot);
  }
  return changed;
}

export function findSupportingDocumentSlotForS3Key(
  data: unknown,
  s3Key: string
): SupportingDocumentSlot | null {
  let found: SupportingDocumentSlot | null = null;
  visitSupportingDocumentSlots(data, (slot, record) => {
    if (found) return;
    if (extractS3KeysFromSupportingSlot(record).includes(s3Key)) {
      found = slot;
    }
  });
  return found;
}

export function hasSupportingDocumentItemLocks(allowedItemKeys: Set<string>): boolean {
  return [...allowedItemKeys].some((key) => key.startsWith(SUPPORTING_DOC_ITEM_PREFIX));
}

export function supportingDocumentSlotIsAllowed(
  categoryKey: string,
  documentIndex: number,
  allowedItemKeys: Set<string>
): boolean {
  return [...allowedItemKeys].some((key) =>
    supportingDocScopeKeyMatchesRow(key, categoryKey, documentIndex, "")
  );
}

export function assertSupportingDocumentSlotEditable(
  categoryKey: string,
  documentIndex: number,
  allowedItemKeys: Set<string>
): void {
  if (!hasSupportingDocumentItemLocks(allowedItemKeys)) return;
  if (supportingDocumentSlotIsAllowed(categoryKey, documentIndex, allowedItemKeys)) return;
  throw new AppError(
    403,
    "AMENDMENT_LOCKED",
    "This document is locked during amendment review"
  );
}
