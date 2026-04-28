/**
 * CTOS company_json director row position codes (ENQWS-style).
 * DO/AD → director only; SO → shareholder only; DS/AS → both.
 * Empty or unknown → director-only (legacy rows without position).
 */
export function ctosPositionDirectorShareholderFlags(position: string | undefined | null): {
  isDirector: boolean;
  isShareholder: boolean;
} {
  const pos = String(position ?? "").trim().toUpperCase();
  if (!pos) {
    return { isDirector: true, isShareholder: false };
  }
  const isDirector = ["DO", "AD", "DS", "AS"].includes(pos);
  const isShareholder = ["SO", "DS", "AS"].includes(pos);
  if (!isDirector && !isShareholder) {
    return { isDirector: true, isShareholder: false };
  }
  return { isDirector, isShareholder };
}
