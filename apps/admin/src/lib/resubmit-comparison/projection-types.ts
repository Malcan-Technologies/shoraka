/**
 * SECTION: Resubmit comparison row projection (frozen contract)
 * WHY: One projection drives both the rendered Before/After rows and the tab Diff badge,
 *      so a tab only shows Diff when a rendered row visibly differs.
 * INPUT: Section projection builders in this folder
 * OUTPUT: Blocks / stages of comparison rows + diff helpers
 * WHERE USED: Resubmit comparison modal, section comparison branches
 */

import { REVIEW_EMPTY_LABEL } from "./shared-format";

/** Already formatted for display. null renders as the empty label. */
export type ComparisonDisplayValue = string | null;

export type ComparisonFileRef = {
  s3Key: string;
  fileName: string;
  /** Display-only secondary line (e.g. size). Never used for diffing. */
  secondary?: string;
};

export type ComparisonRow =
  | {
      key: string;
      label: string;
      kind: "text";
      before: ComparisonDisplayValue;
      after: ComparisonDisplayValue;
      multiline?: boolean;
      hint?: string;
    }
  | { key: string; label: string; kind: "yesno"; before: boolean | null; after: boolean | null }
  | { key: string; label: string; kind: "files"; before: ComparisonFileRef[]; after: ComparisonFileRef[] };

export type ComparisonBlock = { id: string; title: string; rows: ComparisonRow[] };

export type ComparisonStage = { id: string; title: string; blocks: ComparisonBlock[] };

/** Empty-looking display values compare equal ("", "—", "Not provided", null). */
export function normalizeComparisonText(value: ComparisonDisplayValue | undefined): string {
  if (value == null) return "";
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "—" || trimmed === REVIEW_EMPTY_LABEL) return "";
  return trimmed;
}

export function comparisonTextValuesDiffer(
  before: ComparisonDisplayValue | undefined,
  after: ComparisonDisplayValue | undefined
): boolean {
  return normalizeComparisonText(before) !== normalizeComparisonText(after);
}

function fileSetSignature(files: readonly ComparisonFileRef[]): string {
  return files
    .map((f) => `${f.s3Key.trim()}\t${f.fileName.trim()}`)
    .sort()
    .join("\n");
}

/** Order-insensitive: same files in a different order do not differ. */
export function comparisonFilesDiffer(
  before: readonly ComparisonFileRef[],
  after: readonly ComparisonFileRef[]
): boolean {
  return fileSetSignature(before) !== fileSetSignature(after);
}

/**
 * After-side files whose name also exists before but under a different s3 key.
 * The UI must mark these "Replaced" so a same-name re-upload is visibly a change.
 */
export function replacedComparisonFiles(
  before: readonly ComparisonFileRef[],
  after: readonly ComparisonFileRef[]
): ComparisonFileRef[] {
  const beforeKeysByName = new Map<string, Set<string>>();
  for (const f of before) {
    const name = f.fileName.trim();
    const keys = beforeKeysByName.get(name) ?? new Set<string>();
    keys.add(f.s3Key.trim());
    beforeKeysByName.set(name, keys);
  }
  return after.filter((f) => {
    const keys = beforeKeysByName.get(f.fileName.trim());
    return keys != null && !keys.has(f.s3Key.trim());
  });
}

export function comparisonRowDiffers(row: ComparisonRow): boolean {
  switch (row.kind) {
    case "text":
      return comparisonTextValuesDiffer(row.before, row.after);
    case "yesno":
      return row.before !== row.after;
    case "files":
      return comparisonFilesDiffer(row.before, row.after);
  }
}

export function blocksHaveChanges(blocks: readonly ComparisonBlock[]): boolean {
  return blocks.some((block) => block.rows.some(comparisonRowDiffers));
}

export function stagesHaveChanges(stages: readonly ComparisonStage[]): boolean {
  return stages.some((stage) => blocksHaveChanges(stage.blocks));
}
