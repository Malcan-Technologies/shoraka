import {
  FINANCIAL_YEAR_END_ERROR_MESSAGES,
  getAdminFinancialSummaryUserColumnYears,
  getCtosLatestYear,
  getFinancialYearEndAllowedWindow,
  getFinancialYearEndValidationError,
  getInProgressFinancialYearEndYear,
  getIssuerFinancialTabYears,
  getLatestThreeCtosYearSlots,
  getLatestThreeCtosYears,
  issuerUnauditedPlddForFyEndYear,
  normalizeFinancialStatementsQuestionnaire,
  parseFinancialStatementsQuestionnaireShape,
} from "@cashsouk/types";
import { addDays, addYears, format, startOfDay } from "date-fns";
import { financialStatementsV2Schema } from "./schemas";

const refJan2026 = new Date("2026-01-10");
const qMar2027: { financial_year_end: string } = { financial_year_end: "2027-03-31" };

const block = (fyEndYear: number, q: { financial_year_end: string } = qMar2027) => ({
  pldd: issuerUnauditedPlddForFyEndYear(fyEndYear, q),
  bsfatot: 0,
  othass: 0,
  bscatot: 0,
  bsclbank: 0,
  curlib: 0,
  bsslltd: 0,
  bsclstd: 0,
  bsqpuc: 0,
  turnover: 0,
  plnpbt: 0,
  plnpat: 0,
  plnetdiv: 0,
  plyear: 0,
});

describe("financial-unaudited-ctos-validation", () => {
  describe("getCtosLatestYear", () => {
    it("returns null for empty rows", () => {
      expect(getCtosLatestYear([])).toBeNull();
    });
    it("returns max financial_year", () => {
      expect(
        getCtosLatestYear([{ financial_year: 2023 }, { financial_year: 2025 }, { financial_year: 2024 }])
      ).toBe(2025);
    });
  });

  describe("getLatestThreeCtosYears", () => {
    it("returns all years sorted when fewer than 3", () => {
      expect(getLatestThreeCtosYears([{ financial_year: 2022 }, { financial_year: 2024 }])).toEqual([2022, 2024]);
    });
    it("returns last 3 when more exist", () => {
      expect(
        getLatestThreeCtosYears([
          { financial_year: 2020 },
          { financial_year: 2021 },
          { financial_year: 2022 },
          { financial_year: 2023 },
          { financial_year: 2024 },
        ])
      ).toEqual([2022, 2023, 2024]);
    });
  });

  describe("getLatestThreeCtosYearSlots", () => {
    it("pads with null on the left so newest CTOS column is rightmost", () => {
      expect(getLatestThreeCtosYearSlots([{ financial_year: 2025 }])).toEqual([null, null, 2025]);
      expect(getLatestThreeCtosYearSlots([{ financial_year: 2024 }, { financial_year: 2025 }])).toEqual([
        null,
        2024,
        2025,
      ]);
    });
  });

  describe("getIssuerFinancialTabYears", () => {
    it("returns two FY end years when today is before deadline (previous FY end + 6 months)", () => {
      expect(getIssuerFinancialTabYears(qMar2027, refJan2026)).toEqual([2026, 2027]);
    });
    it("returns one FY end year when today is on or after deadline", () => {
      const refLate = new Date("2026-11-01");
      expect(getIssuerFinancialTabYears(qMar2027, refLate)).toEqual([2027]);
    });
  });

  describe("getInProgressFinancialYearEndYear", () => {
    it("is the selected next FYE calendar year for one or two tabs", () => {
      expect(getInProgressFinancialYearEndYear({ financial_year_end: "2026-12-31" })).toBe(2026);
      expect(getInProgressFinancialYearEndYear(qMar2027)).toBe(2027);
    });
  });

  describe("getAdminFinancialSummaryUserColumnYears", () => {
    it("matches issuer tab years for same questionnaire and ref", () => {
      expect(getAdminFinancialSummaryUserColumnYears(null, refJan2026)).toEqual([]);
      expect(getAdminFinancialSummaryUserColumnYears(qMar2027, refJan2026)).toEqual(
        getIssuerFinancialTabYears(qMar2027, refJan2026)
      );
    });
  });

  describe("getFinancialYearEndValidationError", () => {
    const ref = new Date(2026, 8, 18);
    it("rejects today and earlier as not_future", () => {
      expect(getFinancialYearEndValidationError("2026-09-18", ref)).toBe("not_future");
      expect(getFinancialYearEndValidationError("2026-09-17", ref)).toBe("not_future");
    });
    it("accepts tomorrow and the last day whose period has started", () => {
      expect(getFinancialYearEndValidationError("2026-09-19", ref)).toBeNull();
      expect(getFinancialYearEndValidationError("2027-09-17", ref)).toBeNull();
    });
    it("rejects today+12 months via the period formula (+364 valid, +365 beyond)", () => {
      expect(getFinancialYearEndValidationError("2027-09-17", ref)).toBeNull();
      expect(getFinancialYearEndValidationError("2027-09-18", ref)).toBe("beyond_window");
    });
    it("rejects 31 Dec 2027 in Sep 2026 and accepts 31 Mar 2027 / 31 Dec 2026", () => {
      expect(getFinancialYearEndValidationError("2027-12-31", ref)).toBe("beyond_window");
      expect(getFinancialYearEndValidationError("2027-03-31", ref)).toBeNull();
      expect(getFinancialYearEndValidationError("2026-12-31", ref)).toBeNull();
    });
    it("handles leap-year FYE 29 Feb", () => {
      expect(getFinancialYearEndValidationError("2028-02-29", new Date(2027, 2, 1))).toBeNull();
      expect(getFinancialYearEndValidationError("2028-02-29", new Date(2027, 1, 28))).toBe(
        "beyond_window"
      );
    });
    it("returns invalid for unparseable ISO", () => {
      expect(getFinancialYearEndValidationError("2026-02-30", ref)).toBe("invalid");
      expect(getFinancialYearEndValidationError("not-a-date", ref)).toBe("invalid");
    });
    it("exposes the shared messages", () => {
      expect(FINANCIAL_YEAR_END_ERROR_MESSAGES.not_future).toBe(
        "Please select a future financial year end date."
      );
      expect(FINANCIAL_YEAR_END_ERROR_MESSAGES.beyond_window).toBe(
        "Financial year end must be within the next 12 months."
      );
      expect(FINANCIAL_YEAR_END_ERROR_MESSAGES.invalid).toBe("Enter a valid date");
    });
    it("returns inclusive calendar bounds for the picker", () => {
      expect(getFinancialYearEndAllowedWindow(ref)).toEqual({
        minIso: "2026-09-19",
        maxIso: "2027-09-17",
      });
    });
    it("includes leap-day max when validation accepts 29 Feb", () => {
      expect(getFinancialYearEndAllowedWindow(new Date(2027, 2, 1))).toEqual({
        minIso: "2027-03-02",
        maxIso: "2028-02-29",
      });
    });
  });

  describe("parseFinancialStatementsQuestionnaireShape", () => {
    it("accepts an aged FYE without a today-relative check", () => {
      expect(parseFinancialStatementsQuestionnaireShape({ financial_year_end: "2020-12-31" })).toEqual({
        financial_year_end: "2020-12-31",
      });
    });
  });

  describe("normalizeFinancialStatementsQuestionnaire", () => {
    it("returns null for unknown keys", () => {
      expect(
        normalizeFinancialStatementsQuestionnaire({
          last_closing_date: "2020-01-01",
          is_submitted_to_ssm: false,
        })
      ).toBeNull();
    });
    it("returns null when FYE is not strictly after ref", () => {
      expect(
        normalizeFinancialStatementsQuestionnaire({ financial_year_end: "2026-01-10" }, refJan2026)
      ).toBeNull();
    });
    it("returns null when FYE is beyond the 12-month window", () => {
      expect(
        normalizeFinancialStatementsQuestionnaire({ financial_year_end: "2027-03-31" }, refJan2026)
      ).toBeNull();
    });
    it("parses financial_year_end when inside the window", () => {
      expect(
        normalizeFinancialStatementsQuestionnaire({ financial_year_end: "2026-06-30" }, refJan2026)
      ).toEqual({ financial_year_end: "2026-06-30" });
    });
  });

  describe("financialStatementsV2Schema", () => {
    it("rejects legacy questionnaire keys", () => {
      const y2026 = 2026;
      const y2027 = 2027;
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          last_closing_date: "2026-03-31",
          is_submitted_to_ssm: false,
        },
        unaudited_by_year: {
          [String(y2026)]: block(y2026),
          [String(y2027)]: block(y2027),
        },
      });
      expect(parsed.success).toBe(false);
    });
    it("accepts questionnaire and two unaudited years with FYE rules", () => {
      const futureFye = format(addDays(startOfDay(new Date()), 120), "yyyy-MM-dd");
      const q = { financial_year_end: futureFye };
      const years = getIssuerFinancialTabYears(q, new Date());
      const unaudited: Record<string, ReturnType<typeof block>> = {};
      for (const y of years) {
        unaudited[String(y)] = block(y, q);
      }
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: q,
        unaudited_by_year: unaudited,
      });
      expect(parsed.success).toBe(true);
    });
    it("rejects financial_year_end not in the future", () => {
      const past = format(addDays(startOfDay(new Date()), -10), "yyyy-MM-dd");
      const q = { financial_year_end: past };
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: q,
        unaudited_by_year: {},
      });
      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      expect(parsed.error.errors.some((e) => e.message === FINANCIAL_YEAR_END_ERROR_MESSAGES.not_future)).toBe(
        true
      );
    });
    it("rejects FYE +400 days and today+1 year as beyond the window", () => {
      const plus400 = format(addDays(startOfDay(new Date()), 400), "yyyy-MM-dd");
      const plusOneYear = format(addYears(startOfDay(new Date()), 1), "yyyy-MM-dd");
      for (const fye of [plus400, plusOneYear]) {
        const parsed = financialStatementsV2Schema.safeParse({
          questionnaire: { financial_year_end: fye },
          unaudited_by_year: {},
        });
        expect(parsed.success).toBe(false);
        if (parsed.success) continue;
        expect(
          parsed.error.errors.some((e) => e.message === FINANCIAL_YEAR_END_ERROR_MESSAGES.beyond_window)
        ).toBe(true);
      }
    });
    it("accepts FYE +120 and +300 days", () => {
      for (const days of [120, 300]) {
        const futureFye = format(addDays(startOfDay(new Date()), days), "yyyy-MM-dd");
        const q = { financial_year_end: futureFye };
        const years = getIssuerFinancialTabYears(q, new Date());
        const unaudited: Record<string, ReturnType<typeof block>> = {};
        for (const y of years) {
          unaudited[String(y)] = block(y, q);
        }
        const parsed = financialStatementsV2Schema.safeParse({
          questionnaire: q,
          unaudited_by_year: unaudited,
        });
        expect(parsed.success).toBe(true);
      }
    });
    it("CASE F — stores issuer-edited historical turnover after CTOS prefill", () => {
      const futureFye = format(addDays(startOfDay(new Date()), 300), "yyyy-MM-dd");
      const q = { financial_year_end: futureFye };
      const years = getIssuerFinancialTabYears(q, new Date());
      const unaudited: Record<string, ReturnType<typeof block>> = {};
      for (const y of years) {
        unaudited[String(y)] = { ...block(y, q), turnover: y === years[0] ? 220 : 0 };
      }
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: q,
        unaudited_by_year: unaudited,
      });
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      const historicalKey = String(years[0]);
      expect(parsed.data.unaudited_by_year[historicalKey]?.turnover).toBe(220);
    });
    it("accepts optional ComRep extras without requiring them", () => {
      const futureFye = format(addDays(startOfDay(new Date()), 300), "yyyy-MM-dd");
      const q = { financial_year_end: futureFye };
      const years = getIssuerFinancialTabYears(q, new Date());
      const unaudited: Record<string, ReturnType<typeof block> & Record<string, number>> = {};
      for (const y of years) {
        unaudited[String(y)] = block(y, q);
      }
      const withoutExtras = financialStatementsV2Schema.safeParse({
        questionnaire: q,
        unaudited_by_year: unaudited,
      });
      expect(withoutExtras.success).toBe(true);
      if (years[0] != null) {
        unaudited[String(years[0])] = {
          ...block(years[0], q),
          curlib_borrowing: 40,
          equity_share_application: 1,
        };
      }
      const withExtras = financialStatementsV2Schema.safeParse({
        questionnaire: q,
        unaudited_by_year: unaudited,
      });
      expect(withExtras.success).toBe(true);
      if (!withExtras.success || years[0] == null) return;
      expect(withExtras.data.unaudited_by_year[String(years[0])]?.curlib_borrowing).toBe(40);
      expect(withExtras.data.unaudited_by_year[String(years[0])]?.equity_share_application).toBe(1);
    });
  });
});
