"use client";

/**
 * SECTION: Before/after file comparison UI
 * WHY: One pattern for supporting docs, consent PDFs, contract uploads, invoice docs, business attachments.
 * INPUT: title, chip lists (s3Key + label) or projected ComparisonRow
 * OUTPUT: Same chip + two-column layout everywhere; changed rows use comparisonSurfaceChanged* like ComparisonFieldRow.
 *         File lists differ by s3 key + name only (order and size ignored); an After file that reuses a
 *         Before file name under a new s3 key is badged "Replaced".
 * WHERE USED: SupportingDocumentsComparisonLayout; Invoice "Document"; Business supporting docs; Contract / Customer evidence;
 *             ComparisonProjectedRow (projection-driven Company / Business / Documents comparison rows).
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
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AmendmentRemarkReadbackPanel } from "@/components/amendment-remark-readback";
import { cn } from "@/lib/utils";
import {
  REVIEW_EMPTY_LABEL,
  reviewEmptyStateClass,
  reviewLabelClass,
  comparisonCellSurfaceShellClass,
  comparisonFileChipRowShellClass,
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
  comparisonSplitAfterColClass,
  comparisonSplitBeforeColClass,
  comparisonSplitRowGridClass,
} from "./review-section-styles";
import { SUPPORTING_DOC_ACTION_BTN_BASE_CLASS } from "./document-list";
import { SupportingDocRequirementBadges } from "./supporting-doc-requirement-badges";
import {
  supportingDocRowRequirementMeta,
  type SupportingDocRowRequirementMeta,
} from "./supporting-documents-admin-meta";
import { ComparisonFieldRow, ComparisonYesNoRadioRow } from "./comparison-field-row";
import {
  comparisonFilesDiffer,
  comparisonRowDiffers,
  replacedComparisonFiles,
  type ComparisonFileRef,
  type ComparisonRow,
} from "@/lib/resubmit-comparison/projection-types";
import {
  amendmentRemarksForDocumentRow,
  projectDocumentsComparisonWithSlots,
} from "@/lib/resubmit-comparison/documents-projection";

export type ComparisonFileChip = {
  s3Key: string;
  label: string;
  secondary?: string;
};

function chipsToFileRefs(files: readonly ComparisonFileChip[]): ComparisonFileRef[] {
  return files.map((f) => ({ s3Key: f.s3Key, fileName: f.label, secondary: f.secondary }));
}

function fileRefsToChips(files: readonly ComparisonFileRef[]): ComparisonFileChip[] {
  return files.map((f) => ({ s3Key: f.s3Key, label: f.fileName, secondary: f.secondary }));
}

/** Same rule as the Diff badge: s3 key + name only; order and size never count. */
export function comparisonFileChipsDiffer(
  beforeFiles: readonly ComparisonFileChip[],
  afterFiles: readonly ComparisonFileChip[]
): boolean {
  return comparisonFilesDiffer(chipsToFileRefs(beforeFiles), chipsToFileRefs(afterFiles));
}

function ReplacedFileBadge() {
  return (
    <>
      <StatusBadge label="Replaced" status="neutral" showDot={false} size="sm" aria-hidden />
      <span className="sr-only">File replaced</span>
    </>
  );
}

export function ComparisonFileChipList({
  files,
  emptyLabel,
  strikeLabels,
  column = "before",
  accentChanged = false,
  replacedAgainst,
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
  /**
   * After column only: the Before list. Chips that reuse a Before file name under a new s3 key
   * get a "Replaced" badge (same-name re-upload is a real change).
   */
  replacedAgainst?: ComparisonFileChip[];
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const replacedKeys = new Set(
    column === "after" && replacedAgainst
      ? replacedComparisonFiles(chipsToFileRefs(replacedAgainst), chipsToFileRefs(files)).map((f) =>
          f.s3Key.trim()
        )
      : []
  );
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
                {replacedKeys.has(f.s3Key.trim()) ? (
                  <span className="mt-1 block">
                    <ReplacedFileBadge />
                  </span>
                ) : null}
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
                    className={SUPPORTING_DOC_ACTION_BTN_BASE_CLASS}
                    disabled={viewDocumentPending}
                    onClick={() => onViewDocument?.(f.s3Key)}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" />
                    View
                  </Button>
                ) : null}
                {showDownload ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={SUPPORTING_DOC_ACTION_BTN_BASE_CLASS}
                    disabled={viewDocumentPending}
                    onClick={() => onDownloadDocument?.(f.s3Key, f.label)}
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
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
  amendmentNotes,
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
  /** Per-document REQUEST_AMENDMENT text (resubmit comparison). */
  amendmentNotes?: Array<{ remark: string }>;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const filesDiffer = comparisonFileChipsDiffer(beforeFiles, afterFiles);
  const noisy = filesDiffer || !!markChanged;
  /** Only content diff avoids marking every row when a parent path is flagged. */
  const colHighlight = filesDiffer;
  const ariaTitle = requirementMeta
    ? `${title}. ${requirementMeta.required ? "Required" : "Optional"}. ${requirementMeta.multiple ? "Multiple files" : "Single file"}.`
    : title;
  const hasAmendmentNotes = amendmentNotes != null && amendmentNotes.length > 0;
  const remarkTextsForIssuerPanel = React.useMemo(
    () => (amendmentNotes ?? []).map((n) => n.remark),
    [amendmentNotes]
  );

  return (
    <div
      className="py-2 space-y-3"
      role="group"
      aria-label={noisy ? `${ariaTitle}, files changed` : ariaTitle}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={reviewLabelClass}>{title}</p>
          {requirementMeta ? (
            <SupportingDocRequirementBadges meta={requirementMeta} size="compact" className="mt-1" />
          ) : null}
        </div>
        {hasAmendmentNotes ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs"
                aria-label={`Remark for ${title}`}
              >
                Remark
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(22rem,calc(100vw-2rem))] max-h-[min(26rem,75vh)] overflow-y-auto border-border p-3"
              align="end"
              side="bottom"
              sideOffset={8}
            >
              <AmendmentRemarkReadbackPanel remarkTexts={remarkTextsForIssuerPanel} />
            </PopoverContent>
          </Popover>
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
            replacedAgainst={beforeFiles}
            onViewDocument={onViewDocument}
            onDownloadDocument={onDownloadDocument}
            viewDocumentPending={viewDocumentPending}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * SECTION: One projected comparison row
 * WHY: Projection-driven sections render rows straight from ComparisonRow so the Diff badge and
 *      the visible highlight come from the same data.
 * INPUT: ComparisonRow (+ file actions, optional requirement badges / amendment remarks for files)
 * OUTPUT: ComparisonFieldRow (+ hint), ComparisonYesNoRadioRow, or ComparisonDocumentTitleRow
 * WHERE USED: Company / Business comparison branches, SupportingDocumentsComparisonLayout
 */
export function ComparisonProjectedRow({
  row,
  requirementMeta,
  amendmentNotes,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  row: ComparisonRow;
  requirementMeta?: SupportingDocRowRequirementMeta;
  amendmentNotes?: Array<{ remark: string }>;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const differs = comparisonRowDiffers(row);
  switch (row.kind) {
    case "text": {
      const field = (
        <ComparisonFieldRow
          label={row.label}
          before={row.before ?? REVIEW_EMPTY_LABEL}
          after={row.after ?? REVIEW_EMPTY_LABEL}
          changed={differs}
          multiline={row.multiline}
        />
      );
      if (!row.hint) return field;
      return (
        <div>
          {field}
          <p className="text-xs text-muted-foreground">{row.hint}</p>
        </div>
      );
    }
    case "yesno":
      return (
        <ComparisonYesNoRadioRow
          label={row.label}
          beforeValue={row.before}
          afterValue={row.after}
          changed={differs}
        />
      );
    case "files":
      return (
        <ComparisonDocumentTitleRow
          title={row.label}
          requirementMeta={requirementMeta}
          beforeFiles={fileRefsToChips(row.before)}
          afterFiles={fileRefsToChips(row.after)}
          amendmentNotes={amendmentNotes}
          onViewDocument={onViewDocument}
          onDownloadDocument={onDownloadDocument}
          viewDocumentPending={viewDocumentPending}
        />
      );
  }
}

export function SupportingDocumentsComparisonLayout({
  beforeDocs,
  afterDocs,
  supportingDocumentsStepConfig,
  amendmentRemarks,
  facilityLockedCategoryKeys = [],
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  beforeDocs: unknown;
  afterDocs: unknown;
  /** Requirement badges only; never changes which rows render or whether they differ. */
  supportingDocumentsStepConfig?: Record<string, unknown> | null;
  /** Item-level supporting_documents amendment text, matched to each row's before slot by scope_key. */
  amendmentRemarks?: Array<{ scope: string; scope_key: string; remark: string }>;
  /** Drawdown apps: categories inherited from the facility (same badge as live DocumentList). */
  facilityLockedCategoryKeys?: string[];
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const blocks = React.useMemo(
    () =>
      projectDocumentsComparisonWithSlots(
        { supporting_documents: beforeDocs },
        { supporting_documents: afterDocs }
      ),
    [beforeDocs, afterDocs]
  );

  if (blocks.length === 0) {
    return <p className={reviewEmptyStateClass}>No supporting documents in these snapshots.</p>;
  }

  return (
    <div className="space-y-2">
      {blocks.map((block) => {
        const categoryKey = block.id;
        return (
          <Collapsible key={categoryKey} defaultOpen>
            <div className="rounded-xl border">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-muted/50 transition-colors rounded-t-xl [&[data-state=open]]:rounded-b-none"
                >
                  <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                  <DocumentArrowDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  {block.title}
                  {facilityLockedCategoryKeys.includes(categoryKey) ? (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <LockClosedIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Locked at facility
                    </span>
                  ) : null}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t pl-8 pr-4 py-3 space-y-3 sm:pl-10">
                  {block.rows.map((row, rowIndex) => {
                    const slot = block.rowSlots[rowIndex];
                    const rowAmendmentNotes = amendmentRemarksForDocumentRow(
                      amendmentRemarks,
                      slot?.remarkScopeKey ?? null
                    );
                    const requirementSlotIndex = slot?.requirementSlotIndex ?? null;
                    return (
                      <ComparisonProjectedRow
                        key={row.key}
                        row={row}
                        requirementMeta={
                          requirementSlotIndex == null
                            ? undefined
                            : supportingDocRowRequirementMeta(
                                supportingDocumentsStepConfig,
                                categoryKey,
                                requirementSlotIndex
                              )
                        }
                        amendmentNotes={rowAmendmentNotes.length > 0 ? rowAmendmentNotes : undefined}
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
