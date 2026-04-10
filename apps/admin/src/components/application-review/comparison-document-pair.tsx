"use client";

/**
 * SECTION: Before/after file comparison UI
 * WHY: One pattern for supporting docs, consent PDFs, contract uploads, invoice docs, business attachments.
 * INPUT: title, chip lists (s3Key + label), optional path highlight from field_changes
 * OUTPUT: Same chip + two-column layout everywhere; changed rows use comparisonSurfaceChanged* like ComparisonFieldRow.
 * WHERE USED: SupportingDocumentsComparisonLayout; Invoice "Document"; Business supporting docs; Contract / Customer evidence.
 */

import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { SUPPORTING_DOC_CATEGORY_KEYS } from "@/app/settings/products/workflow-builder/product-form-helpers";
import { cn } from "@/lib/utils";
import {
  reviewEmptyStateClass,
  reviewLabelClass,
  formatFileSize,
  comparisonCellSurfaceShellClass,
  comparisonFileChipRowShellClass,
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
  comparisonSplitAfterColClass,
  comparisonSplitBeforeColClass,
  comparisonSplitRowGridClass,
} from "./review-section-styles";
import { buildCategoryGroups, type DocFile } from "./document-list";
import { SupportingDocRequirementBadges } from "./supporting-doc-requirement-badges";
import type { SupportingDocRowRequirementMeta } from "./supporting-documents-admin-meta";

export type ComparisonFileChip = {
  s3Key: string;
  label: string;
  secondary?: string;
};

export function comparisonFileChipsSignature(files: ComparisonFileChip[]): string {
  return [...files]
    .map((f) => `${f.s3Key}\t${f.label}\t${f.secondary ?? ""}`)
    .sort()
    .join("\n");
}

export function ComparisonFileChipList({
  files,
  emptyLabel,
  strikeLabels,
  column = "before",
  accentChanged = false,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  files: ComparisonFileChip[];
  emptyLabel: string;
  /** When true, primary line uses strikethrough (e.g. superseded before column). */
  strikeLabels?: boolean;
  /** Before: muted like retired submission. After: primary text (full contrast). */
  column?: "before" | "after";
  /** When lists differ: same ring + tint as comparison fields (before/after surface tokens). */
  accentChanged?: boolean;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const tone = column === "before" ? "text-muted-foreground" : "text-foreground";
  const changedHighlight =
    accentChanged &&
    (column === "before" ? comparisonSurfaceChangedBeforeClass : comparisonSurfaceChangedAfterClass);
  if (files.length === 0) {
    return (
      <div className={cn(comparisonCellSurfaceShellClass, tone, changedHighlight)}>{emptyLabel}</div>
    );
  }
  return (
    <ul className="space-y-2">
      {files.map((f, idx) => {
        const hasKey = Boolean(f.s3Key?.trim());
        const showView = Boolean(hasKey && onViewDocument);
        const showDownload = Boolean(hasKey && onDownloadDocument);
        return (
          <li
            key={`${f.s3Key}-${idx}`}
            className={cn(
              comparisonFileChipRowShellClass,
              changedHighlight,
              tone,
              (showView || showDownload) &&
                "flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <DocumentTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block break-all text-sm",
                    strikeLabels &&
                      "line-through decoration-muted-foreground/80 decoration-1 [text-decoration-skip-ink:none]"
                  )}
                >
                  {f.label || f.s3Key}
                </span>
                {f.secondary ? (
                  <span
                    className={cn(
                      "mt-0.5 block text-xs text-muted-foreground",
                      strikeLabels &&
                        "line-through decoration-muted-foreground/70 decoration-1 [text-decoration-skip-ink:none]"
                    )}
                  >
                    {f.secondary}
                  </span>
                ) : null}
              </span>
            </div>
            {showView || showDownload ? (
              <div className="flex shrink-0 flex-wrap gap-1 sm:justify-end">
                {showView ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 rounded-lg border-0"
                    disabled={viewDocumentPending}
                    onClick={() => onViewDocument?.(f.s3Key)}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    View
                  </Button>
                ) : null}
                {showDownload ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 rounded-lg border-0"
                    disabled={viewDocumentPending}
                    onClick={() => onDownloadDocument?.(f.s3Key, f.label)}
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Download
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function ComparisonDocumentTitleRow({
  title,
  requirementMeta,
  beforeFiles,
  afterFiles,
  markChanged,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  title: string;
  /** From product workflow — badge row under title */
  requirementMeta?: SupportingDocRowRequirementMeta;
  beforeFiles: ComparisonFileChip[];
  afterFiles: ComparisonFileChip[];
  /** Included in aria-label when set or when file lists differ. */
  markChanged?: boolean;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const filesDiffer =
    comparisonFileChipsSignature(beforeFiles) !== comparisonFileChipsSignature(afterFiles);
  const noisy = filesDiffer || !!markChanged;
  /** Only content diff avoids marking every row when a parent path is flagged. */
  const colHighlight = filesDiffer;
  const ariaTitle = requirementMeta
    ? `${title}. ${requirementMeta.required ? "Required" : "Optional"}. ${requirementMeta.multiple ? "Multiple files" : "Single file"}.`
    : title;
  return (
    <div
      className="py-2 space-y-3"
      role="group"
      aria-label={noisy ? `${ariaTitle}, files changed` : ariaTitle}
    >
      <div>
        <p className={reviewLabelClass}>{title}</p>
        {requirementMeta ? (
          <SupportingDocRequirementBadges meta={requirementMeta} size="compact" className="mt-1" />
        ) : null}
      </div>
      <div className={comparisonSplitRowGridClass}>
        <div className={comparisonSplitBeforeColClass}>
          <ComparisonFileChipList
            files={beforeFiles}
            emptyLabel="—"
            strikeLabels={filesDiffer && beforeFiles.length > 0}
            column="before"
            accentChanged={colHighlight}
            onViewDocument={onViewDocument}
            onDownloadDocument={onDownloadDocument}
            viewDocumentPending={viewDocumentPending}
          />
        </div>
        <div className={comparisonSplitAfterColClass}>
          <ComparisonFileChipList
            files={afterFiles}
            emptyLabel="—"
            column="after"
            accentChanged={colHighlight}
            onViewDocument={onViewDocument}
            onDownloadDocument={onDownloadDocument}
            viewDocumentPending={viewDocumentPending}
          />
        </div>
      </div>
    </div>
  );
}

export function fileDocToComparisonChips(doc: {
  s3_key?: string;
  file_name?: string;
  file_size?: number;
} | undefined): ComparisonFileChip[] {
  if (!doc?.s3_key || String(doc.s3_key).trim() === "") return [];
  const label =
    typeof doc.file_name === "string" && doc.file_name.trim() !== ""
      ? doc.file_name
      : "Attached file";
  const secondary =
    typeof doc.file_size === "number" && doc.file_size > 0
      ? formatFileSize(doc.file_size)
      : undefined;
  return [{ s3Key: String(doc.s3_key), label, secondary }];
}

export function businessSupportingDocsToChips(
  docs: Array<{ s3Key: string; fileName: string; fileSize?: number }>
): ComparisonFileChip[] {
  return docs.map((d) => ({
    s3Key: d.s3Key,
    label: d.fileName,
    secondary:
      typeof d.fileSize === "number" && d.fileSize > 0 ? formatFileSize(d.fileSize) : undefined,
  }));
}

function docFilesToChips(files: DocFile[]): ComparisonFileChip[] {
  return files.map((f) => ({
    s3Key: f.s3Key,
    label: f.label,
    secondary: f.secondary,
  }));
}

export function SupportingDocumentsComparisonLayout({
  beforeDocs,
  afterDocs,
  supportingDocumentsStepConfig,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  beforeDocs: unknown;
  afterDocs: unknown;
  supportingDocumentsStepConfig?: Record<string, unknown> | null;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const beforeGroups = React.useMemo(
    () => buildCategoryGroups(beforeDocs, supportingDocumentsStepConfig),
    [beforeDocs, supportingDocumentsStepConfig]
  );
  const afterGroups = React.useMemo(
    () => buildCategoryGroups(afterDocs, supportingDocumentsStepConfig),
    [afterDocs, supportingDocumentsStepConfig]
  );
  const beforeByKey = React.useMemo(
    () => new Map(beforeGroups.map((g) => [g.categoryKey, g])),
    [beforeGroups]
  );
  const afterByKey = React.useMemo(
    () => new Map(afterGroups.map((g) => [g.categoryKey, g])),
    [afterGroups]
  );
  const categoryKeys = Array.from(new Set([...beforeByKey.keys(), ...afterByKey.keys()]));
  const order = SUPPORTING_DOC_CATEGORY_KEYS;
  categoryKeys.sort((a, b) => {
    const ia = order.indexOf(a as (typeof order)[number]);
    const ib = order.indexOf(b as (typeof order)[number]);
    if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  if (categoryKeys.length === 0) {
    return <p className={reviewEmptyStateClass}>No supporting documents in these snapshots.</p>;
  }

  return (
    <div className="space-y-2">
      {categoryKeys.map((categoryKey) => {
        const bG = beforeByKey.get(categoryKey);
        const aG = afterByKey.get(categoryKey);
        const categoryLabel = bG?.categoryLabel ?? aG?.categoryLabel ?? String(categoryKey);
        const bItems = bG?.items ?? [];
        const aItems = aG?.items ?? [];
        const maxLen = Math.max(bItems.length, aItems.length);
        return (
          <Collapsible key={String(categoryKey)} defaultOpen>
            <div className="rounded-xl border border-border">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center gap-2 px-4 py-3 text-left text-base font-semibold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-muted/50 transition-colors rounded-t-xl [&[data-state=open]]:rounded-b-none"
                >
                  <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                  <DocumentArrowDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  {categoryLabel}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border pl-4 sm:pl-12 pr-4 py-4 space-y-6">
                  {Array.from({ length: maxLen }, (_, i) => {
                    const bi = bItems[i];
                    const ai = aItems[i];
                    const title = bi?.label ?? ai?.label ?? `Document ${i + 1}`;
                    const requirementMeta = bi?.requirementMeta ?? ai?.requirementMeta;
                    const beforeChips = docFilesToChips(bi?.files ?? []);
                    const afterChips = docFilesToChips(ai?.files ?? []);
                    return (
                      <ComparisonDocumentTitleRow
                        key={`${String(categoryKey)}-${i}-${bi?.key ?? ""}-${ai?.key ?? ""}`}
                        title={title}
                        requirementMeta={requirementMeta}
                        beforeFiles={beforeChips}
                        afterFiles={afterChips}
                        onViewDocument={onViewDocument}
                        onDownloadDocument={onDownloadDocument}
                        viewDocumentPending={viewDocumentPending}
                      />
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
