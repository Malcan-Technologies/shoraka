import {
  getCtosLatestYear,
  getLatestThreeCtosYears,
  getIssuerFinancialInputYearsFromQuestionnaire,
  normalizeFinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { financialStatementsV2Schema } from "./schemas";

const closing = "2026-03-31";
const block = (y: string) => ({
  pldd: closing,
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

  describe("getIssuerFinancialInputYearsFromQuestionnaire", () => {
    it("submitted: one year from closing date", () => {
      expect(
        getIssuerFinancialInputYearsFromQuestionnaire({
          last_closing_date: closing,
          is_submitted_to_ssm: true,
        })
      ).toEqual([2026]);
    });
    it("not submitted: current and prior year", () => {
      expect(
        getIssuerFinancialInputYearsFromQuestionnaire({
          last_closing_date: closing,
          is_submitted_to_ssm: false,
        })
      ).toEqual([2026, 2025]);
    });
  });

  describe("normalizeFinancialStatementsQuestionnaire", () => {
    it("returns null for unknown keys", () => {
      expect(
        normalizeFinancialStatementsQuestionnaire({
          latest_financial_year: 2024,
          submitted_this_financial_year: true,
          has_data_for_next_financial_year: false,
        })
      ).toBeNull();
    });
    it("parses current questionnaire keys", () => {
      expect(
        normalizeFinancialStatementsQuestionnaire({
          last_closing_date: closing,
          is_submitted_to_ssm: false,
        })
      ).toEqual({
        last_closing_date: closing,
        is_submitted_to_ssm: false,
      });
    });
  });

  describe("financialStatementsV2Schema", () => {
    it("rejects legacy questionnaire keys", () => {
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          latest_financial_year: 2025,
          submitted_this_financial_year: false,
          has_data_for_next_financial_year: true,
        },
        unaudited_by_year: {
          "2025": block("2025"),
          "2026": block("2026"),
        },
      });
      expect(parsed.success).toBe(false);
    });
    it("accepts current questionnaire keys and matching pldd", () => {
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          last_closing_date: closing,
          is_submitted_to_ssm: false,
        },
        unaudited_by_year: {
          "2025": block("2025"),
          "2026": block("2026"),
        },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.questionnaire).toEqual({
          last_closing_date: closing,
          is_submitted_to_ssm: false,
        });
      }
    });
    it("rejects last_closing_date in the future", () => {
      const futureClosing = "2099-12-31";
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          last_closing_date: futureClosing,
          is_submitted_to_ssm: false,
        },
        unaudited_by_year: {
          "2098": { ...block("2098"), pldd: futureClosing },
          "2099": { ...block("2099"), pldd: futureClosing },
        },
      });
      expect(parsed.success).toBe(false);
    });
  });
});
