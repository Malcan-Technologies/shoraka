import {
  formatFinancialFyPeriodDisplay,
  getLatestThreeCtosYearSlots,
  isFinancialYearPeriodOpen,
  parseFinancialStatementsQuestionnaireShape,
  type CtosFinancialYearRowInput,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";

export type AdminFinancialSummaryColumn = {
  kind: "ctos" | "unaudited" | "admin_input" | "admin_fallback_placeholder" | "empty";
  year: number | null;
  statementType?: string;
};

/** Three CTOS slots, then stored issuer years that do not overlap those CTOS years. */
export function adminFinancialSummaryColumns(
  ctosRows: CtosFinancialYearRowInput[] | null | undefined,
  unauditedByYear: Record<string, unknown> | null | undefined,
  adminInputByYear: Record<string, unknown> | null | undefined,
  eligibleAdminInputYears: number[]
): AdminFinancialSummaryColumn[] {
  const ctosSlotYears = getLatestThreeCtosYearSlots(ctosRows ?? []);
  const ctosYearSet = new Set(
    ctosSlotYears.filter((year): year is number => typeof year === "number")
  );
  const unaudited = storedUnauditedYears(unauditedByYear)
    .filter((year) => !ctosYearSet.has(year))
    .map((year) => ({ kind: "unaudited" as const, year }));

  const issuerYearSet = new Set(unaudited.map((x) => x.year).filter((y): y is number => typeof y === "number"));

  const adminInputYears = storedUnauditedYears(adminInputByYear).filter(
    (year) => !ctosYearSet.has(year) && !issuerYearSet.has(year)
  );

  const adminInputColumns: AdminFinancialSummaryColumn[] = adminInputYears.map((year) => {
    const record = (adminInputByYear as any)?.[String(year)] as Record<string, unknown> | undefined;
    const statementType = typeof record?.statementType === "string" ? record.statementType : undefined;
    return { kind: "admin_input", year, statementType };
  });

  const takenYears = new Set<number>([
    ...Array.from(ctosYearSet.values()),
    ...Array.from(issuerYearSet.values()),
    ...adminInputYears,
  ]);

  const eligibleSorted = eligibleAdminInputYears
    .filter((y) => !takenYears.has(y))
    .sort((a, b) => a - b);

  const remainingAdminInputYears = new Set<number>(adminInputYears);
  const remainingPlaceholderYears = new Set<number>(eligibleSorted);

  return [
    ...ctosSlotYears.map((year) => {
      if (typeof year === "number") return { kind: "ctos" as const, year };

      // Fill null CTOS slots with stored Admin Input first, then eligible missing Admin placeholders.
      const nextAdmin = adminInputYears.find((y) => remainingAdminInputYears.has(y));
      if (typeof nextAdmin === "number") {
        remainingAdminInputYears.delete(nextAdmin);
        const rec = (adminInputByYear as any)?.[String(nextAdmin)] as Record<string, unknown> | undefined;
        const statementType =
          typeof rec?.statementType === "string" ? (rec?.statementType as string) : undefined;
        return { kind: "admin_input" as const, year: nextAdmin, statementType };
      }

      const nextPlaceholder = eligibleSorted.find((y) => remainingPlaceholderYears.has(y));
      if (typeof nextPlaceholder === "number") {
        remainingPlaceholderYears.delete(nextPlaceholder);
        return { kind: "admin_fallback_placeholder" as const, year: nextPlaceholder };
      }
      return { kind: "empty" as const, year: null };
    }),
    ...[...adminInputColumns, ...unaudited]
      .filter((c) => c.year == null || remainingAdminInputYears.has(c.year) || c.kind === "unaudited")
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
  ];
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
