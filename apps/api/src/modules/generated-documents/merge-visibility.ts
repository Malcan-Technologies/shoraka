/** Shown for optional / unwired scalars that have no source data. */
export const MERGE_EMPTY_DISPLAY = "N/A";

type MergeNullPart = {
  module?: string;
  value?: string;
};

/** Empty scalars print N/A so production documents never leak `{merge_key}`. */
export function visibleMergeScalar(_key: string, value: string): string {
  return value.trim() ? value : MERGE_EMPTY_DISPLAY;
}

export function mergeNullGetter(part: MergeNullPart): string | never[] {
  if (part.module === "rawxml") return "";
  if (part.module === "loop") return [];
  if (part.value) return MERGE_EMPTY_DISPLAY;
  return "";
}
