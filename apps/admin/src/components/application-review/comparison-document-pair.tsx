"use client";

/**
 * SECTION: Before/after file comparison UI
 * WHY: One pattern for supporting docs, consent PDFs, contract uploads, invoice docs, business attachments.
 * INPUT: title, chip lists (s3Key + label), optional path highlight from field_changes
 * OUTPUT: Same chip + two-column layout as supporting-documents comparison
 * WHERE USED: Documents, Customer, Contract, Invoice, Business comparison modes
 */

import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDownIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { SUPPORTING_DOC_CATEGORY_KEYS } from "@/app/settings/products/workflow-builder/product-form-helpers";
import { reviewEmptyStateClass, formatFileSize, comparisonFileChipRowClass } from "./review-section-styles";
import { buildCategoryGroups, type DocFile } from "./document-list";

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
}: {
  files: ComparisonFileChip[];
  emptyLabel: string;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {files.map((f, idx) => (
        <li key={`${f.s3Key}-${idx}`} className={comparisonFileChipRowClass}>
          <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <span className="min-w-0 flex-1">
            <span className="text-sm text-foreground break-all block">{f.label || f.s3Key}</span>
            {f.secondary ? (
              <span className="text-xs text-muted-foreground block mt-0.5">{f.secondary}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ComparisonDocumentTitleRow({
  title,
  beforeFiles,
  afterFiles,
  markChanged,
}: {
  title: string;
  beforeFiles: ComparisonFileChip[];
  afterFiles: ComparisonFileChip[];
  /** Included in aria-label when set or when file lists differ. */
  markChanged?: boolean;
}) {
  const filesDiffer =
    comparisonFileChipsSignature(beforeFiles) !== comparisonFileChipsSignature(afterFiles);
  const noisy = filesDiffer || !!markChanged;
  return (
    <div
      className="py-2 space-y-3"
      role="group"
      aria-label={noisy ? `${title}, files changed` : title}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0">
        <div className="md:pr-4 md:border-r md:border-border space-y-2 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Before</p>
          <ComparisonFileChipList files={beforeFiles} emptyLabel="—" />
        </div>
        <div className="md:pl-4 space-y-2 min-w-0 pt-4 md:pt-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">After</p>
          <ComparisonFileChipList files={afterFiles} emptyLabel="—" />
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
  docs: Array<{ s3Key: string; fileName: string }>
): ComparisonFileChip[] {
  return docs.map((d) => ({
    s3Key: d.s3Key,
    label: d.fileName,
  }));
}

function docFilesToChips(files: DocFile[]): ComparisonFileChip[] {
  return files.map((f) => ({ s3Key: f.s3Key, label: f.label }));
}

export function SupportingDocumentsComparisonLayout({
  beforeDocs,
  afterDocs,
}: {
  beforeDocs: unknown;
  afterDocs: unknown;
}) {
  const beforeGroups = React.useMemo(() => buildCategoryGroups(beforeDocs), [beforeDocs]);
  const afterGroups = React.useMemo(() => buildCategoryGroups(afterDocs), [afterDocs]);
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
                    const beforeChips = docFilesToChips(bi?.files ?? []);
                    const afterChips = docFilesToChips(ai?.files ?? []);
                    return (
                      <ComparisonDocumentTitleRow
                        key={`${String(categoryKey)}-${i}-${bi?.key ?? ""}-${ai?.key ?? ""}`}
                        title={title}
                        beforeFiles={beforeChips}
                        afterFiles={afterChips}
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
