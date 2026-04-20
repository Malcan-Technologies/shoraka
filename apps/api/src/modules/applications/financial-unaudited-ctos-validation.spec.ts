import {
  getAdminFinancialSummaryUserColumnYears,
  getCtosLatestYear,
  getIssuerFinancialTabYears,
  getLatestThreeCtosYearSlots,
  getLatestThreeCtosYears,
  issuerUnauditedPlddForFyEndYear,
  normalizeFinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { addDays, format, startOfDay } from "date-fns";
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

  describe("getAdminFinancialSummaryUserColumnYears", () => {
    it("matches issuer tab years for same questionnaire and ref", () => {
      expect(getAdminFinancialSummaryUserColumnYears(null, refJan2026)).toEqual([]);
      expect(getAdminFinancialSummaryUserColumnYears(qMar2027, refJan2026)).toEqual(
        getIssuerFinancialTabYears(qMar2027, refJan2026)
      );
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
    it("parses financial_year_end when future", () => {
      expect(normalizeFinancialStatementsQuestionnaire({ financial_year_end: "2027-03-31" }, refJan2026)).toEqual(
        qMar2027
      );
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
    });
  });
});
