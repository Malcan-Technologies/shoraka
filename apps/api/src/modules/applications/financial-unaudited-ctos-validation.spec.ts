import {
  getCtosLatestYear,
  getLatestThreeCtosYears,
  validateUnauditedColumn,
  getExpectedUnauditedYearsFromQuestionnaire,
  normalizeFinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { financialStatementsV2Schema } from "./schemas";

describe("financial-unaudited-ctos-validation", () => {
  describe("getCtosLatestYear", () => {
    it("returns null for empty rows", () => {
      expect(getCtosLatestYear([])).toBeNull();
    });
    it("returns max reporting_year", () => {
      expect(getCtosLatestYear([{ reporting_year: 2023 }, { reporting_year: 2025 }, { reporting_year: 2024 }])).toBe(
        2025
      );
    });
  });

  describe("getLatestThreeCtosYears", () => {
    it("returns all years sorted when fewer than 3", () => {
      expect(getLatestThreeCtosYears([{ reporting_year: 2022 }, { reporting_year: 2024 }])).toEqual([2022, 2024]);
    });
    it("returns last 3 when more exist", () => {
      expect(
        getLatestThreeCtosYears([
          { reporting_year: 2020 },
          { reporting_year: 2021 },
          { reporting_year: 2022 },
          { reporting_year: 2023 },
          { reporting_year: 2024 },
        ])
      ).toEqual([2022, 2023, 2024]);
    });
  });

  describe("validateUnauditedColumn", () => {
    it("VALID when unaudited is ctosLatest + 1", () => {
      const r = validateUnauditedColumn({
        ctosLatestYear: 2025,
        unauditedYear: 2026,
        latestYearSubmitted: true,
        financialYearEndYear: 2025,
      });
      expect(r.status).toBe("VALID");
    });
    it("INVALID when duplicate CTOS year", () => {
      const r = validateUnauditedColumn({
        ctosLatestYear: 2025,
        unauditedYear: 2025,
        latestYearSubmitted: false,
        financialYearEndYear: 2025,
      });
      expect(r.status).toBe("INVALID");
    });
    it("PENDING when no CTOS", () => {
      const r = validateUnauditedColumn({
        ctosLatestYear: null,
        unauditedYear: 2026,
        latestYearSubmitted: false,
        financialYearEndYear: 2025,
      });
      expect(r.status).toBe("PENDING");
    });
    it("CASE 5 PENDING when submitted Y ahead of CTOS", () => {
      const r = validateUnauditedColumn({
        ctosLatestYear: 2024,
        unauditedYear: 2026,
        latestYearSubmitted: true,
        financialYearEndYear: 2025,
      });
      expect(r.status).toBe("PENDING");
    });
    it("INVALID too far ahead when not CASE 5", () => {
      const r = validateUnauditedColumn({
        ctosLatestYear: 2024,
        unauditedYear: 2026,
        latestYearSubmitted: false,
        financialYearEndYear: 2024,
      });
      expect(r.status).toBe("INVALID");
    });
  });

  describe("getExpectedUnauditedYearsFromQuestionnaire", () => {
    it("Case A", () => {
      expect(
        getExpectedUnauditedYearsFromQuestionnaire({
          latest_financial_year: 2025,
          submitted_this_financial_year: false,
          has_data_for_next_financial_year: false,
        })
      ).toEqual([2025]);
    });
    it("Case D", () => {
      expect(
        getExpectedUnauditedYearsFromQuestionnaire({
          latest_financial_year: 2025,
          submitted_this_financial_year: true,
          has_data_for_next_financial_year: true,
        })
      ).toEqual([2026]);
    });
    it("Case C empty", () => {
      expect(
        getExpectedUnauditedYearsFromQuestionnaire({
          latest_financial_year: 2025,
          submitted_this_financial_year: true,
          has_data_for_next_financial_year: false,
        })
      ).toEqual([]);
    });
  });

  describe("normalizeFinancialStatementsQuestionnaire", () => {
    it("maps legacy questionnaire keys", () => {
      expect(
        normalizeFinancialStatementsQuestionnaire({
          financial_year_end_year: 2024,
          latest_year_submitted: true,
          has_next_financial_year_data: false,
        })
      ).toEqual({
        latest_financial_year: 2024,
        submitted_this_financial_year: true,
        has_data_for_next_financial_year: false,
      });
    });
  });

  describe("financialStatementsV2Schema questionnaire preprocess", () => {
    it("accepts legacy questionnaire keys in v2 payload", () => {
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          financial_year_end_year: 2025,
          latest_year_submitted: false,
          has_next_financial_year_data: true,
        },
        unaudited_by_year: {
          "2025": { pldd: "2025", bsdd: "31/12/2025" },
          "2026": { pldd: "2026", bsdd: "31/12/2026" },
        },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.questionnaire).toEqual({
          latest_financial_year: 2025,
          submitted_this_financial_year: false,
          has_data_for_next_financial_year: true,
        });
      }
    });
  });
});
