/**
 * SECTION: Supporting documents category grouping (pure)
 * WHY: Live DocumentList and the resubmit comparison projection must group slots identically;
 *      kept free of React/UI imports so the projection runs under jest.
 * INPUT: supporting_documents payload; optional workflow step config for requirement hints
 * OUTPUT: Category groups in payload order with item keys + file refs
 * WHERE USED: DocumentList (via re-export), documents-projection
 */

import { SUPPORTING_DOC_CATEGORY_KEYS, SUPPORTING_DOC_CATEGORY_LABELS } from "@cashsouk/types";
import {
  supportingDocRowRequirementMeta,
  type SupportingDocRowRequirementMeta,
} from "@/components/application-review/supporting-documents-admin-meta";
import { formatFileSize } from "./shared-format";

export function formattedFileSize(row: Record<string, unknown> | undefined): string | undefined {
  if (!row) return undefined;
  const raw = row.file_size ?? row.fileSize;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return undefined;
  return formatFileSize(raw);
}

export type DocFile = { label: string; s3Key: string; secondary?: string };
export type DocItem = {
  key: string;
  label: string;
  /**
   * Workflow document title (never the file name). Titles are stable across resubmits, so the
   * comparison projection pairs before/after slots by it (list positions can shift); absent when
   * the slot is untitled (the projection then pairs it positionally among untitled slots).
   */
  slotTitle?: string;
  s3Key?: string;
  downloadFileName?: string;
  files: DocFile[];
  /** From product workflow — shown as badges */
  requirementMeta?: SupportingDocRowRequirementMeta;
};
export type CategoryGroup = { categoryKey: string; categoryLabel: string; items: DocItem[] };

/** Same grouping as the live review document list (categories + item keys). */
export function buildCategoryGroups(
  documents: unknown,
  supportingDocumentsStepConfig?: Record<string, unknown> | null
): CategoryGroup[] {
  if (typeof documents !== "object") return [];
  const raw = (documents as Record<string, unknown>)?.supporting_documents ?? documents;
  if (Array.isArray(raw)) {
    const items: DocItem[] = raw.map((d: Record<string, unknown>, i: number) => {
      const file = d?.file as { s3_key?: string } | undefined;
      const name = String(d?.name ?? d?.title ?? "document");
      const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
      const base: DocItem = {
        key: `supporting_documents:others:${i}:${slug}`,
        label: name || `Document ${i + 1}`,
        slotTitle: String(d?.title ?? d?.name ?? "").trim() || undefined,
        s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
        downloadFileName:
          typeof (d?.file as { file_name?: string } | undefined)?.file_name === "string"
            ? (d?.file as { file_name?: string }).file_name
            : undefined,
        files:
          typeof (file?.s3_key ?? (d?.s3_key as string | undefined)) === "string" &&
          String(file?.s3_key ?? (d?.s3_key as string | undefined)).trim() !== ""
            ? [
                {
                  label: name || `Document ${i + 1}`,
                  s3Key: String(file?.s3_key ?? (d?.s3_key as string | undefined)),
                  secondary: formattedFileSize(file as Record<string, unknown>),
                },
              ]
            : [],
      };
      const meta = supportingDocRowRequirementMeta(supportingDocumentsStepConfig, "others", i);
      return meta ? { ...base, requirementMeta: meta } : base;
    });
    return items.length > 0 ? [{ categoryKey: "others", categoryLabel: "Others", items }] : [];
  }
  if (typeof raw !== "object" || raw === null) return [];

  const cats = (raw as Record<string, unknown>).categories;
  if (Array.isArray(cats)) {
    const labelToKey: Record<string, string> = {};
    SUPPORTING_DOC_CATEGORY_KEYS.forEach((k) => {
      labelToKey[SUPPORTING_DOC_CATEGORY_LABELS[k]] = k;
    });
    const groups: CategoryGroup[] = [];
    cats.forEach((cat: Record<string, unknown>, catIndex: number) => {
      const categoryLabel = String(cat?.name ?? `Category ${catIndex + 1}`);
      const categoryKey = labelToKey[categoryLabel] ?? `cat_${catIndex}`;
      const docList = Array.isArray(cat?.documents) ? cat.documents : [];
      const items: DocItem[] = docList.map((d: Record<string, unknown>, docIndex: number) => {
        const files = Array.isArray(d?.files)
          ? (d.files as Array<{ file_name?: string; s3_key?: string; file_size?: number; fileSize?: number }>)
          : [];
        const file =
          (d?.file as {
            file_name?: string;
            s3_key?: string;
            file_size?: number;
            fileSize?: number;
          } | undefined) ?? files[0];
        const viewFiles = files
          .filter((f) => typeof f?.s3_key === "string" && f.s3_key.trim() !== "")
          .map((f, fileIndex) => ({
            label: String(f.file_name ?? `File ${fileIndex + 1}`),
            s3Key: String(f.s3_key),
            secondary: formattedFileSize(f as Record<string, unknown>),
          }));
        if (viewFiles.length === 0 && typeof file?.s3_key === "string" && file.s3_key.trim() !== "") {
          viewFiles.push({
            label: String(file.file_name ?? `File 1`),
            s3Key: String(file.s3_key),
            secondary: formattedFileSize(file as Record<string, unknown>),
          });
        }
        const fileCount = files.length > 0 ? files.length : file ? 1 : 0;
        const label =
          String(d?.title ?? file?.file_name ?? d?.name ?? "").trim() ||
          `Document ${docIndex + 1}`;
        const labelWithCount =
          fileCount > 1 ? `${label} (${fileCount} files)` : label;
        const slug = label.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
        // Identity is the document title only; the file name / "Document n" label fallback is not.
        const slotTitle = String(d?.title ?? d?.name ?? "").trim();
        const base: DocItem = {
          key: `supporting_documents:${categoryKey}:${docIndex}:${slug}`,
          label: labelWithCount,
          ...(slotTitle !== "" ? { slotTitle } : {}),
          s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
          downloadFileName:
            typeof file?.file_name === "string" && file.file_name.trim() !== ""
              ? file.file_name
              : undefined,
          files: viewFiles,
        };
        const meta = supportingDocRowRequirementMeta(
          supportingDocumentsStepConfig,
          categoryKey,
          docIndex
        );
        return meta ? { ...base, requirementMeta: meta } : base;
      });
      if (items.length > 0) {
        groups.push({ categoryKey, categoryLabel, items });
      }
    });
    if (groups.length > 0) return groups;
  }

  const groups: CategoryGroup[] = [];
  for (const categoryKey of SUPPORTING_DOC_CATEGORY_KEYS) {
    const val = (raw as Record<string, unknown>)[categoryKey];
    if (val == null) continue;
    const arr = Array.isArray(val) ? val : [val];
    const items: DocItem[] = arr.map((d: Record<string, unknown>, i: number) => {
      const file = d?.file as {
        s3_key?: string;
        file_name?: string;
        file_size?: number;
        fileSize?: number;
      } | undefined;
      const name = String(d?.name ?? d?.title ?? "doc");
      const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
      const base: DocItem = {
        key: `supporting_documents:${categoryKey}:${i}:${slug}`,
        label: name || `${categoryKey} ${i + 1}`,
        slotTitle: String(d?.title ?? d?.name ?? "").trim() || undefined,
        s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
        downloadFileName:
          typeof file?.file_name === "string" ? file.file_name : undefined,
        files:
          typeof (file?.s3_key ?? (d?.s3_key as string | undefined)) === "string" &&
          String(file?.s3_key ?? (d?.s3_key as string | undefined)).trim() !== ""
            ? [
                {
                  label: name || `${categoryKey} ${i + 1}`,
                  s3Key: String(file?.s3_key ?? (d?.s3_key as string | undefined)),
                  secondary: formattedFileSize(file as Record<string, unknown>),
                },
              ]
            : [],
      };
      const meta = supportingDocRowRequirementMeta(supportingDocumentsStepConfig, categoryKey, i);
      return meta ? { ...base, requirementMeta: meta } : base;
    });
    if (items.length > 0) {
      groups.push({
        categoryKey,
        categoryLabel: SUPPORTING_DOC_CATEGORY_LABELS[categoryKey] ?? categoryKey,
        items,
      });
    }
  }
  return groups;
}
