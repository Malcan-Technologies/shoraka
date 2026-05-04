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
      if (pos.includes("DIRECTOR") && !pos.includes("SHAREHOLDER")) {
        return { isDirector: true, isShareholder: false };
      }
      if (pos.includes("SHAREHOLDER") && !pos.includes("DIRECTOR")) {
        return { isDirector: false, isShareholder: true };
      }
      if (pos.includes("DIRECTOR") && pos.includes("SHAREHOLDER")) {
        return { isDirector: true, isShareholder: true };
      }
      return { isDirector: false, isShareholder: false };
  }
}
