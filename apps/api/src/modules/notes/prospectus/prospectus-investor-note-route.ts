/**
 * SECTION: Investor Note investment path helper
 * WHY: Match current investor app links: /investments/{note.id}
 * WHERE USED: Shared route validation utilities (not frozen Prospectus CTA HTML)
 */

/** Path prefix confirmed in apps/investor note detail / marketplace links. */
export const PROSPECTUS_INVESTOR_NOTE_PATH_PREFIX = "/investments/";

/**
 * Build the current investor Note detail/invest path from a Note id.
 * Returns null when the identifier is missing or unsafe.
 */
export function buildProspectusInvestorNoteInvestmentPath(
  noteId: unknown
): string | null {
  if (typeof noteId !== "string") return null;
  const trimmed = noteId.trim();
  // Note ids are cuid strings; reject path segments, protocols, and opaque junk.
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(trimmed)) return null;
  return `${PROSPECTUS_INVESTOR_NOTE_PATH_PREFIX}${encodeURIComponent(trimmed)}`;
}

/**
 * Accept only a URL that already matches the confirmed internal Note path.
 * Rejects external URLs, #, javascript:, data:, and other protocols.
 */
export function parseConfirmedProspectusInvestorNoteInvestmentPath(
  value: unknown
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith(PROSPECTUS_INVESTOR_NOTE_PATH_PREFIX)) return null;
  if (trimmed.includes("://") || trimmed.includes("?") || trimmed.includes("#")) {
    return null;
  }
  const noteId = trimmed.slice(PROSPECTUS_INVESTOR_NOTE_PATH_PREFIX.length);
  return buildProspectusInvestorNoteInvestmentPath(decodeURIComponent(noteId));
}
