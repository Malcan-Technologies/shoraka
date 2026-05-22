export type CompanyNameCompareStatus = "match" | "difference" | "unavailable";

export type CompanyNameCompareResult = {
  status: CompanyNameCompareStatus;
  isMatch: boolean;
  submittedName: string | null;
  extractedName: string | null;
  normalizedSubmittedName: string | null;
  normalizedExtractedName: string | null;
};

function collapseSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Normalize company names for strict display-name comparisons.
 * - trim
 * - uppercase
 * - collapse multiple spaces
 * - keep punctuation (dots/commas) as-is so differences are visible
 */
export function normalizeCompanyNameForStrictCheck(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t || t === "—") return null;

  const s = collapseSpaces(t.toUpperCase());
  return s.length > 0 ? s : null;
}

export function compareCompanyNamesForStrictDisplayExact(args: {
  submittedName: string | null | undefined;
  extractedName: string | null | undefined;
}): CompanyNameCompareResult {
  const submitted = args.submittedName ?? null;
  const extracted = args.extractedName ?? null;

  const normalizedSubmittedName = normalizeCompanyNameForStrictCheck(submitted);
  const normalizedExtractedName = normalizeCompanyNameForStrictCheck(extracted);

  const unavailable = !normalizedSubmittedName || !normalizedExtractedName;
  if (unavailable) {
    return {
      status: "unavailable",
      isMatch: false,
      submittedName: submitted && String(submitted).trim() !== "" ? String(submitted) : null,
      extractedName: extracted && String(extracted).trim() !== "" ? String(extracted) : null,
      normalizedSubmittedName,
      normalizedExtractedName,
    };
  }

  const isMatch = normalizedSubmittedName === normalizedExtractedName;
  return {
    status: isMatch ? "match" : "difference",
    isMatch,
    submittedName: submitted ? String(submitted) : null,
    extractedName: extracted ? String(extracted) : null,
    normalizedSubmittedName,
    normalizedExtractedName,
  };
}

