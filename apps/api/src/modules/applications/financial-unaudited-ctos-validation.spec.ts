import {
  getAdminFinancialSummaryUserColumnYears,
  getCtosLatestYear,
  getFinancialInputBaseYears,
  getIssuerFinancialTabYears,
  getLatestThreeCtosYearSlots,
  getLatestThreeCtosYears,
  issuerUnauditedPlddForStartYear,
  normalizeFinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { financialStatementsV2Schema } from "./schemas";

const closing = "2026-03-31";
const ref2026 = new Date("2026-06-15");
const qTwo = { last_closing_date: closing, is_submitted_to_ssm: false as const };

const block = (startYear: number, q: { last_closing_date: string; is_submitted_to_ssm: boolean } = qTwo) => ({
  pldd: issuerUnauditedPlddForStartYear(startYear, q, ref2026),
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

  describe("getAdminFinancialSummaryUserColumnYears", () => {
    it("returns empty when nothing submitted in window", () => {
      expect(getAdminFinancialSummaryUserColumnYears([], ref2026)).toEqual([]);
      expect(getAdminFinancialSummaryUserColumnYears([2024], ref2026)).toEqual([]);
    });
    it("returns one year when only that tab exists (ref 2026 → window 2025–2026)", () => {
      expect(getAdminFinancialSummaryUserColumnYears([2025], ref2026)).toEqual([2025]);
      expect(getAdminFinancialSummaryUserColumnYears([2026], ref2026)).toEqual([2026]);
    });
    it("returns both years ascending when both submitted", () => {
      expect(getAdminFinancialSummaryUserColumnYears([2025, 2026], ref2026)).toEqual([2025, 2026]);
      expect(getAdminFinancialSummaryUserColumnYears([2026, 2025], ref2026)).toEqual([2025, 2026]);
    });
  });

  describe("getIssuerFinancialTabYears", () => {
    it("submitted: year2 only from ref", () => {
      expect(getIssuerFinancialTabYears(true, ref2026)).toEqual([2026]);
    });
    it("not submitted: year1 then year2 from ref", () => {
      expect(getIssuerFinancialTabYears(false, ref2026)).toEqual([2025, 2026]);
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
      const { year1, year2 } = getFinancialInputBaseYears(ref2026);
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          latest_financial_year: 2025,
          submitted_this_financial_year: false,
          has_data_for_next_financial_year: true,
        },
        unaudited_by_year: {
          [String(year1)]: block(year1),
          [String(year2)]: block(year2),
        },
      });
      expect(parsed.success).toBe(false);
    });
    it("accepts questionnaire and two unaudited years with pldd rules", () => {
      const { year1, year2 } = getFinancialInputBaseYears(ref2026);
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          last_closing_date: closing,
          is_submitted_to_ssm: false,
        },
        unaudited_by_year: {
          [String(year1)]: block(year1),
          [String(year2)]: block(year2),
        },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.questionnaire).toEqual({
          last_closing_date: closing,
          is_submitted_to_ssm: false,
        });
        expect(parsed.data.unaudited_by_year[String(year1)].pldd).toBe(closing);
        expect(parsed.data.unaudited_by_year[String(year2)].pldd).toBe("");
      }
    });
    it("accepts submitted SSM with one unaudited year (year2)", () => {
      const { year2 } = getFinancialInputBaseYears(ref2026);
      const qSub = { last_closing_date: closing, is_submitted_to_ssm: true as const };
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          last_closing_date: closing,
          is_submitted_to_ssm: true,
        },
        unaudited_by_year: {
          [String(year2)]: block(year2, qSub),
        },
      });
      expect(parsed.success).toBe(true);
    });
    it("rejects last_closing_date in the future", () => {
      const futureClosing = "2099-12-31";
      const { year1, year2 } = getFinancialInputBaseYears();
      const parsed = financialStatementsV2Schema.safeParse({
        questionnaire: {
          last_closing_date: futureClosing,
          is_submitted_to_ssm: false,
        },
        unaudited_by_year: {
          [String(year1)]: { ...block(year1), pldd: "" },
          [String(year2)]: { ...block(year2), pldd: "" },
        },
      });
      expect(parsed.success).toBe(false);
    });
  });
});
