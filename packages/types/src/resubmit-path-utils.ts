/**
 * Path matching for APPLICATION_RESUBMITTED `field_changes[].path` vs UI row keys.
 */

export function buildResubmitChangedPathSet(
  fieldChanges: { path?: string }[] | undefined
): Set<string> {
  const s = new Set<string>();
  if (!fieldChanges) return s;
  for (const fc of fieldChanges) {
    if (typeof fc.path === "string" && fc.path.length > 0) s.add(fc.path);
  }
  return s;
}

export function resubmitPathIsChanged(candidatePath: string, changedPaths: Set<string>): boolean {
  for (const p of changedPaths) {
    if (p === candidatePath) return true;
    if (p.startsWith(`${candidatePath}.`) || p.startsWith(`${candidatePath}[`)) return true;
    if (
      candidatePath.startsWith(`${p}.`) ||
      candidatePath.startsWith(`${p}[`) ||
      candidatePath === p
    ) {
      return true;
    }
  }
  return false;
}
