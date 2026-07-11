/**
 * CTOS company_json director row position codes (ENQWS-style), after parse.
 * DO/AD → director only; SO → shareholder only; DS/AS → both; SC → neutral (no role).
 * Empty position → director-only (legacy rows without position).
 * Any other unknown code → neutral (same as SC).
 */
export function ctosPositionDirectorShareholderFlags(position: string | undefined | null): {
  isDirector: boolean;
  isShareholder: boolean;
} {
  const pos = String(position ?? "").trim().toUpperCase();
  if (!pos) {
    return { isDirector: true, isShareholder: false };
  }
  // Some sources provide text labels (e.g. "Director", "Shareholder")
  // instead of compact CTOS codes (DO/SO/DS/AS).
  const normalized = pos.replace(/[^A-Z]/g, "");
  const looksDirector = normalized.includes("DIRECTOR");
  const looksShareholder = normalized.includes("SHAREHOLDER");
  if (looksDirector || looksShareholder) {
    return { isDirector: looksDirector, isShareholder: looksShareholder };
  }
  switch (pos) {
    case "DO":
    case "AD":
      return { isDirector: true, isShareholder: false };
    case "SO":
      return { isDirector: false, isShareholder: true };
    case "DS":
    case "AS":
      return { isDirector: true, isShareholder: true };
    case "SC":
      return { isDirector: false, isShareholder: false };
    default:
      return { isDirector: false, isShareholder: false };
  }
}
