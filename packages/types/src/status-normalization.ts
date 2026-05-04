/**
 * SECTION: Raw status normalization
 * WHY: Keep status display aligned with DB/raw values only
 * INPUT: Any unknown status-like value
 * OUTPUT: Trimmed uppercased underscore token or empty string
 * WHERE USED: UI status badges and status text surfaces
 */
export function normalizeRawStatus(v?: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.toUpperCase().replace(/\s+/g, "_");
}
