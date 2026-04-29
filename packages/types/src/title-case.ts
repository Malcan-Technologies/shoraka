/**
 * SECTION: Title case for display labels
 * WHY: Human-readable status text without changing stored/raw values
 * INPUT: Any label string (e.g. "IN PROGRESS", "APPROVED", "NOT_STARTED")
 * OUTPUT: Title Case words (e.g. "In Progress", "Approved", "Not Started")
 * WHERE USED: Status badges and tables (display only)
 */
export function toTitleCase(s: string): string {
  const normalized = String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (!normalized) return "";

  return normalized
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
