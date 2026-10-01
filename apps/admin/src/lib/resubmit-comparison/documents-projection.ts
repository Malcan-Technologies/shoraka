/**
 * SECTION: Documents tab resubmit comparison projection
 * WHY: Same rows render the Documents comparison and decide its Diff badge.
 * INPUT: Before / after review apps built from revision snapshots
 * OUTPUT: One block per category (after payload order, then before-only categories) with one files
 *         row per document slot, plus each row's workflow slot index for requirement badges
 * WHERE USED: SupportingDocumentsComparisonLayout, resubmit comparison modal badge + Documents
 *             tab Remark bar (unmatched item remarks)
 *
 * Category matching: standard categories pair by their standard key; custom categories (category
 * key cat_<payload index>, which shifts on insert/reorder) pair by normalized label (trim,
 * case-insensitive). Duplicate identities pair by occurrence, never by array position. Block id =
 * standard key (or "<key>#<n>" for a repeat), or "custom:<label>#<n>"; the before/after group
 * category keys travel on the block for requirement / facility-lock lookups.
 *
 * Slot matching: before/after slots pair by slot title (workflow document title; duplicates pair
 * by occurrence), never by list position, so a removed or reordered slot cannot shift its
 * neighbours. Untitled slots pair by occurrence among untitled slots in the category (never by
 * file name, so replacing the file keeps the row). Rows follow the after payload order, then
 * before-only slots in their order.
 * Row key = category + matched before/after indexes (unique per block); label = the after slot's
 * (current file count), else before. Per row slot metadata: requirement badges use the after index
 * (the step config comes from the after snapshot), amendment remarks use the before slot's item key
 * (remarks were raised on the before revision).
 */

import type { ReviewApplicationView } from "@/components/application-review/section-content";
import {
  blocksHaveChanges,
  type ComparisonBlock,
  type ComparisonFileRef,
  type ComparisonRow,
} from "./projection-types";
import { SUPPORTING_DOC_CATEGORY_KEYS } from "@cashsouk/types";
import { documentAmendmentScopeMatchesRow } from "@/lib/document-amendment-scope-match";
import {
  buildCategoryGroups,
  type CategoryGroup,
  type DocFile,
  type DocItem,
} from "./documents-category-groups";

function docFilesToRefs(files: readonly DocFile[]): ComparisonFileRef[] {
  return files.map((f) => ({
    s3Key: f.s3Key,
    fileName: f.label,
    ...(f.secondary ? { secondary: f.secondary } : {}),
  }));
}

const STANDARD_CATEGORY_KEYS = new Set<string>(SUPPORTING_DOC_CATEGORY_KEYS);

/**
 * Stable identity per category group: standard key, else "custom:<normalized label>"; repeats of
 * the same identity get "#<occurrence>" (standard first occurrence keeps the bare key).
 */
function categoryIdentities(groups: readonly CategoryGroup[]): string[] {
  const seen = new Map<string, number>();
  return groups.map((g) => {
    const isStandard = STANDARD_CATEGORY_KEYS.has(g.categoryKey);
    const base = isStandard
      ? g.categoryKey
      : `custom:${g.categoryLabel.trim().toLowerCase()}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    if (isStandard) return occurrence === 0 ? base : `${base}#${occurrence}`;
    return `${base}#${occurrence}`;
  });
}

type MatchedCategory = { id: string; before?: CategoryGroup; after?: CategoryGroup };

/** Live DocumentList shows the current (after) payload order; categories only in before follow in their order. */
function matchCategories(before: CategoryGroup[], after: CategoryGroup[]): MatchedCategory[] {
  const beforeIds = categoryIdentities(before);
  const afterIds = categoryIdentities(after);
  const beforeById = new Map(beforeIds.map((id, index) => [id, before[index]!]));
  const afterIdSet = new Set(afterIds);
  const matched: MatchedCategory[] = after.map((g, index) => ({
    id: afterIds[index]!,
    before: beforeById.get(afterIds[index]!),
    after: g,
  }));
  before.forEach((g, index) => {
    if (!afterIdSet.has(beforeIds[index]!)) matched.push({ id: beforeIds[index]!, before: g });
  });
  return matched;
}

/**
 * Stable identity of a slot within its category: title + occurrence. Untitled slots are positional
 * among untitled slots only (their file name is not an identity).
 */
function slotIdentities(items: readonly DocItem[]): string[] {
  const seen = new Map<string, number>();
  let untitled = 0;
  return items.map((item) => {
    const title = item.slotTitle?.trim() ?? "";
    if (title === "") return `#untitled:${untitled++}`;
    const occurrence = seen.get(title) ?? 0;
    seen.set(title, occurrence + 1);
    return `${title}\u0000${occurrence}`;
  });
}

type MatchedSlot = {
  before?: DocItem;
  after?: DocItem;
  beforeIndex: number | null;
  afterIndex: number | null;
};

/** After payload order first, then slots only present before (in their order). */
function matchSlots(bItems: readonly DocItem[], aItems: readonly DocItem[]): MatchedSlot[] {
  const beforeIds = slotIdentities(bItems);
  const afterIds = slotIdentities(aItems);
  const beforeIndexById = new Map(beforeIds.map((id, index) => [id, index]));
  const matchedBefore = new Set<number>();
  const slots: MatchedSlot[] = aItems.map((after, afterIndex) => {
    const beforeIndex = beforeIndexById.get(afterIds[afterIndex]!);
    if (beforeIndex == null) return { after, beforeIndex: null, afterIndex };
    matchedBefore.add(beforeIndex);
    return { before: bItems[beforeIndex], after, beforeIndex, afterIndex };
  });
  bItems.forEach((before, beforeIndex) => {
    if (!matchedBefore.has(beforeIndex)) slots.push({ before, beforeIndex, afterIndex: null });
  });
  return slots;
}

/** Per-row metadata for the layout. Never affects which rows render or whether they differ. */
export type DocumentsComparisonRowSlot = {
  /**
   * After workflow slot index for supportingDocRowRequirementMeta (the step config is the after
   * snapshot's). null for before-only rows: they get no requirement badges.
   */
  requirementSlotIndex: number | null;
  /**
   * The before slot's item key, matched against amendment remark scope keys (remarks were raised on
   * the before revision). null for after-only rows: they get no remarks.
   */
  remarkScopeKey: string | null;
};

export type DocumentsComparisonBlock = ComparisonBlock & {
  /** Same order and length as rows. */
  rowSlots: DocumentsComparisonRowSlot[];
  /**
   * The after group's categoryKey (buildCategoryGroups) for requirement badges — the step config
   * is the after snapshot's. null for before-only categories: no requirement badges.
   */
  afterCategoryKey: string | null;
  /** The before group's categoryKey; null for after-only categories. */
  beforeCategoryKey: string | null;
};

type AmendmentRemark = { scope: string; scope_key: string; remark: string };

/** Single matching rule for rows and the unmatched list: item-level supporting_documents remark vs a before slot key. */
function remarkMatchesDocumentRow(r: AmendmentRemark, remarkScopeKey: string): boolean {
  return (
    r.scope === "item" &&
    r.scope_key.startsWith("supporting_documents:") &&
    documentAmendmentScopeMatchesRow(r.scope_key, remarkScopeKey)
  );
}

/** Item-level supporting_documents remarks for one row; matches only the row's before slot. */
export function amendmentRemarksForDocumentRow(
  remarks: ReadonlyArray<AmendmentRemark> | undefined,
  remarkScopeKey: string | null
): Array<{ remark: string }> {
  if (!remarks || remarkScopeKey == null) return [];
  return remarks
    .filter((r) => remarkMatchesDocumentRow(r, remarkScopeKey))
    .map((r) => ({ remark: r.remark }));
}

/** Rows + per-row slot metadata; projectDocumentsComparison is this without the metadata. */
export function projectDocumentsComparisonWithSlots(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): DocumentsComparisonBlock[] {
  const beforeGroups = buildCategoryGroups(beforeApp.supporting_documents);
  const afterGroups = buildCategoryGroups(afterApp.supporting_documents);

  return matchCategories(beforeGroups, afterGroups).map(({ id, before: bG, after: aG }) => {
    const slots = matchSlots(bG?.items ?? [], aG?.items ?? []);
    const rows: ComparisonRow[] = slots.map(({ before, after, beforeIndex, afterIndex }) => ({
      key: `${id}:b${beforeIndex ?? "-"}:a${afterIndex ?? "-"}`,
      label: after?.label ?? before?.label ?? `Document ${(afterIndex ?? beforeIndex ?? 0) + 1}`,
      kind: "files",
      before: docFilesToRefs(before?.files ?? []),
      after: docFilesToRefs(after?.files ?? []),
    }));
    return {
      id,
      title: aG?.categoryLabel ?? bG?.categoryLabel ?? id,
      rows,
      rowSlots: slots.map((slot) => ({
        requirementSlotIndex: slot.afterIndex,
        remarkScopeKey: slot.before?.key ?? null,
      })),
      afterCategoryKey: aG?.categoryKey ?? null,
      beforeCategoryKey: bG?.categoryKey ?? null,
    };
  });
}

/**
 * Item-level supporting_documents remarks that match no comparison row's before slot (slot or
 * category gone from the before payload). Same predicate as amendmentRemarksForDocumentRow, so a
 * remark is shown either on a row or in the Documents tab Remark bar — never both, never neither.
 * Section-level remarks are not returned (the bar shows those itself). API order kept.
 */
export function unmatchedDocumentAmendmentRemarks<R extends AmendmentRemark>(
  remarks: ReadonlyArray<R> | undefined,
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): R[] {
  if (!remarks?.length) return [];
  const rowKeys = projectDocumentsComparisonWithSlots(beforeApp, afterApp).flatMap((b) =>
    b.rowSlots.flatMap((s) => (s.remarkScopeKey == null ? [] : [s.remarkScopeKey]))
  );
  return remarks.filter(
    (r) =>
      r.scope === "item" &&
      r.scope_key.startsWith("supporting_documents:") &&
      !rowKeys.some((key) => remarkMatchesDocumentRow(r, key))
  );
}

export function projectDocumentsComparison(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): ComparisonBlock[] {
  return projectDocumentsComparisonWithSlots(beforeApp, afterApp).map(({ id, title, rows }) => ({
    id,
    title,
    rows,
  }));
}

export function documentsComparisonHasChanges(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): boolean {
  return blocksHaveChanges(projectDocumentsComparison(beforeApp, afterApp));
}
