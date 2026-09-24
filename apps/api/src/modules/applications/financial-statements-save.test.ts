import { addDays, format, startOfDay } from "date-fns";
import { FINANCIAL_YEAR_END_ERROR_MESSAGES, getIssuerFinancialTabYears } from "@cashsouk/types";
import {
  parseFinancialStatementsForStepSave,
  shouldPreserveStoredFinancialYears,
} from "./financial-statements-save";

function yearBlock(pldd: string) {
  return {
    pldd,
    bsfatot: 1,
    othass: 0,
    bscatot: 0,
    bsclbank: 0,
    cashAndBank: 3,
    tradeReceivables: 4,
    curlib: 0,
    bsslltd: 0,
    bsclstd: 0,
    bsqpuc: 0,
    tradePayables: 5,
    turnover: 10,
    plnpbt: 0,
    plnpat: 0,
    plnetdiv: 0,
    plyear: 0,
    grossProfit: 1,
    ebitda: 2,
    operatingCashFlow: 6,
    freeCashFlow: 7,
  };
}

function payloadForFye(fyeIso: string, years: number[]) {
  const unaudited_by_year: Record<string, ReturnType<typeof yearBlock>> = {};
  for (const y of years) {
    unaudited_by_year[String(y)] = yearBlock(`${y}-12-31`);
  }
  return { questionnaire: { financial_year_end: fyeIso }, unaudited_by_year };
}

describe("shouldPreserveStoredFinancialYears", () => {
  it("is true only for amendment when the incoming FYE matches the stored FYE", () => {
    const stored = payloadForFye("2027-12-31", [2026, 2027]);
    expect(
      shouldPreserveStoredFinancialYears({
        applicationStatus: "AMENDMENT_REQUESTED",
        storedFinancialStatements: stored,
        incomingFinancialYearEnd: "2027-12-31",
      })
    ).toBe(true);
    expect(
      shouldPreserveStoredFinancialYears({
        applicationStatus: "DRAFT",
        storedFinancialStatements: stored,
        incomingFinancialYearEnd: "2027-12-31",
      })
    ).toBe(false);
    expect(
      shouldPreserveStoredFinancialYears({
        applicationStatus: "AMENDMENT_REQUESTED",
        storedFinancialStatements: stored,
        incomingFinancialYearEnd: "2027-06-30",
      })
    ).toBe(false);
  });
});

describe("parseFinancialStatementsForStepSave", () => {
  const now = startOfDay(new Date());
  const staleFye = format(addDays(now, 400), "yyyy-MM-dd");
  const validFye = format(addDays(now, 120), "yyyy-MM-dd");
  const staleYears = getIssuerFinancialTabYears({ financial_year_end: staleFye }, now);

  it("rejects a draft save of a beyond-window FYE", () => {
    const payload = payloadForFye(staleFye, staleYears);
    const result = parseFinancialStatementsForStepSave({
      applicationStatus: "DRAFT",
      storedFinancialStatements: payload,
      payload,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(FINANCIAL_YEAR_END_ERROR_MESSAGES.beyond_window);
    }
  });

  it("accepts an amendment save that keeps the stored beyond-window FYE and year keys", () => {
    const stored = payloadForFye(staleFye, staleYears);
    const result = parseFinancialStatementsForStepSave({
      applicationStatus: "AMENDMENT_REQUESTED",
      storedFinancialStatements: stored,
      payload: stored,
      now,
    });
    expect(result).toMatchObject({ ok: true, expectedYears: staleYears });
  });

  it("still requires the live window when amendment changes the FYE", () => {
    const stored = payloadForFye(staleFye, staleYears);
    const changed = payloadForFye(format(addDays(now, 401), "yyyy-MM-dd"), staleYears);
    const result = parseFinancialStatementsForStepSave({
      applicationStatus: "AMENDMENT_REQUESTED",
      storedFinancialStatements: stored,
      payload: changed,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(FINANCIAL_YEAR_END_ERROR_MESSAGES.beyond_window);
    }
  });

  it("uses live expected years when amendment picks a new in-window FYE", () => {
    const stored = payloadForFye(staleFye, staleYears);
    const liveYears = getIssuerFinancialTabYears({ financial_year_end: validFye }, now);
    const incoming = payloadForFye(validFye, liveYears);
    const result = parseFinancialStatementsForStepSave({
      applicationStatus: "AMENDMENT_REQUESTED",
      storedFinancialStatements: stored,
      payload: incoming,
      now,
    });
    expect(result).toMatchObject({ ok: true, expectedYears: liveYears });
  });

  it("keeps the 7 new canonical issuer raw fields in stored normalized output", () => {
    const stored = payloadForFye(staleFye, staleYears);
    const result = parseFinancialStatementsForStepSave({
      applicationStatus: "AMENDMENT_REQUESTED",
      storedFinancialStatements: stored,
      payload: stored,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byYear = result.data.unaudited_by_year as Record<string, Record<string, unknown>>;
    const someYear = String(staleYears[0]);
    const block = byYear[someYear];
    expect(block.grossProfit).toBe(1);
    expect(block.ebitda).toBe(2);
    expect(block.cashAndBank).toBe(3);
    expect(block.tradeReceivables).toBe(4);
    expect(block.tradePayables).toBe(5);
    expect(block.operatingCashFlow).toBe(6);
    expect(block.freeCashFlow).toBe(7);
    expect(block.costOfSales).toBe(0);
    expect(block.netOperatingIncome).toBe(0);
    expect(block.annualDebtService).toBe(0);
  });
});
