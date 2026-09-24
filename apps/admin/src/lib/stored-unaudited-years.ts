import {
  formatFinancialFyPeriodDisplay,
  isFinancialYearPeriodOpen,
  parseFinancialStatementsQuestionnaireShape,
  resolveAdminFinancialReviewColumns,
  type CtosFinancialYearRowInput,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";

export type AdminFinancialSummaryColumn = {
  kind: "ctos" | "unaudited" | "admin_input" | "admin_fallback_placeholder" | "empty";
  year: number | null;
  statementType?: string;
};

/** Chronological FY columns. One column per year. CTOS wins a duplicate FY. No empty pad slots. */
export function adminFinancialSummaryColumns(
  ctosRows: CtosFinancialYearRowInput[] | null | undefined,
  unauditedByYear: Record<string, unknown> | null | undefined,
  adminInputByYear: Record<string, unknown> | null | undefined,
  eligibleAdminInputYears: number[],
  ctosFetchState: "not_pulled" | "no_records" | "has_data" = "not_pulled"
): AdminFinancialSummaryColumn[] {
  return resolveAdminFinancialReviewColumns({
    financialStatements: {
      unaudited_by_year: unauditedByYear ?? {},
      admin_input_by_year: adminInputByYear ?? {},
    },
    ctosFinancials: ctosRows ?? [],
    eligibleAdminInputYears,
    ctosFetchState,
  }).map((column) => ({
    kind: column.kind,
    year: column.year,
    statementType: column.statementType,
  }));
}

/** Numeric FY keys from stored `unaudited_by_year`, oldest → newest. */
export function storedUnauditedYears(
  byYear: Record<string, unknown> | null | undefined
): number[] {
  if (!byYear || typeof byYear !== "object" || Array.isArray(byYear)) return [];
  const years: number[] = [];
  for (const key of Object.keys(byYear)) {
    const n = Number(key);
    if (Number.isInteger(n)) years.push(n);
  }
  return years.sort((a, b) => a - b);
}

export function extractQuestionnaireAndUnaudited(financialRaw: unknown): {
  questionnaire: FinancialStatementsQuestionnaire | null;
  unauditedByYear: Record<string, Record<string, unknown>>;
} {
  if (!financialRaw || typeof financialRaw !== "object") {
    return { questionnaire: null, unauditedByYear: {} };
  }
  const obj = financialRaw as Record<string, unknown>;
  const qRaw = obj.questionnaire;
  const byYear = obj.unaudited_by_year as Record<string, Record<string, unknown>> | undefined;
  if (
    qRaw &&
    typeof qRaw === "object" &&
    byYear &&
    typeof byYear === "object" &&
    !Array.isArray(byYear)
  ) {
    const questionnaire = parseFinancialStatementsQuestionnaireShape(qRaw);
    return { questionnaire, unauditedByYear: byYear };
  }
  return { questionnaire: null, unauditedByYear: {} };
}

export function extractQuestionnaireUnauditedAndAdminInput(financialRaw: unknown): {
  questionnaire: FinancialStatementsQuestionnaire | null;
  unauditedByYear: Record<string, Record<string, unknown>>;
  adminInputByYear: Record<string, Record<string, unknown>>;
} {
  if (!financialRaw || typeof financialRaw !== "object") {
    return { questionnaire: null, unauditedByYear: {}, adminInputByYear: {} };
  }
  const obj = financialRaw as Record<string, unknown>;
  const extracted = extractQuestionnaireAndUnaudited(obj);
  const adminInputByYearRaw = obj.admin_input_by_year as
    | Record<string, Record<string, unknown>>
    | undefined;
  const adminInputByYear =
    adminInputByYearRaw && typeof adminInputByYearRaw === "object" && !Array.isArray(adminInputByYearRaw)
      ? adminInputByYearRaw
      : {};
  return {
    questionnaire: extracted.questionnaire,
    unauditedByYear: extracted.unauditedByYear,
    adminInputByYear,
  };
}

/** Split a period for narrow admin headers so dates do not wrap mid-token. */
export function adminFyPeriodLines(periodLine: string): string[] {
  const parts = periodLine.split(" – ");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return [`${parts[0]} –`, parts[1]];
  }
  return periodLine ? [periodLine] : [];
}

/** Admin Financial Summary header for an issuer unaudited year. */
export function adminUnauditedYearPresentation(
  questionnaire: FinancialStatementsQuestionnaire | null,
  year: number,
  ref: Date = new Date()
): { periodLine: string; sourceLabel: string; isOpen: boolean } {
  if (!questionnaire) {
    return { periodLine: "", sourceLabel: "User Input", isOpen: false };
  }
  const isOpen = isFinancialYearPeriodOpen(questionnaire, year, ref);
  return {
    periodLine: formatFinancialFyPeriodDisplay(questionnaire, year, { clampEndTo: ref }),
    sourceLabel: "User Input",
    isOpen,
  };
}

export type ComparisonUnauditedGroupHeader = {
  year: number | null;
  periodLine: string;
};

/**
 * Shared FY/period for an index-aligned Before/After unaudited slot.
 * Only claim a single year when both columns share it or only one side exists.
 * Period always comes from that snapshot's questionnaire (after if afterYear is set).
 */
export function comparisonUnauditedGroupHeader(
  slot: { beforeYear: string | null; afterYear: string | null },
  questionnaires: {
    before: FinancialStatementsQuestionnaire | null;
    after: FinancialStatementsQuestionnaire | null;
  },
  ref: Date = new Date()
): ComparisonUnauditedGroupHeader {
  const { beforeYear, afterYear } = slot;
  if (beforeYear != null && afterYear != null && beforeYear !== afterYear) {
    return { year: null, periodLine: "" };
  }
  const yearKey = afterYear ?? beforeYear;
  const year = yearKey != null ? Number(yearKey) : NaN;
  if (!Number.isInteger(year)) {
    return { year: null, periodLine: "" };
  }
  const questionnaire = afterYear != null ? questionnaires.after : questionnaires.before;
  return {
    year,
    periodLine: questionnaire
      ? adminUnauditedYearPresentation(questionnaire, year, ref).periodLine
      : "",
  };
}
