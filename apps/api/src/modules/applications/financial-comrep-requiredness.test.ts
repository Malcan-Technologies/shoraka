import { assertRequiredFinancialComrepFieldsPresentOrThrow } from "./financial-comrep-requiredness";
import { AppError } from "../../lib/http/error-handler";

function validRequiredBlock(): Record<string, unknown> {
  return {
    curlib_borrowing: 1,
    curlib_non_borrowing: 1,
    ncl_loan: 1,
    ncl_non_loan: 1,
    equity_accumulated_profit: 1,
    operating_cost: 1,
    admin_cost: 1,
    interest_cost: 1,
    other_cost: 1,
    // Core money inputs (required)
    bsfatot: 1,
    othass: 1,
    bscatot: 1,
    bsclbank: 1,
    cashAndBank: 1,
    tradeReceivables: 1,
    curlib: 1,
    bsslltd: 1,
    bsclstd: 1,
    bsqpuc: 1,
    tradePayables: 1,
    turnover: 1,
    grossProfit: 1,
    ebitda: 1,
    plnpbt: 1,
    plnpat: 1,
    plnetdiv: 1,
    plyear: 1,
    operatingCashFlow: 1,
    freeCashFlow: 1,
    // Extra issuer raw money inputs (required)
    costOfSales: 1,
    netOperatingIncome: 1,
    annualDebtService: 1,
    pl_minority: 1,
  };
}

describe("Financial Statements — ComRep requiredness enforcement", () => {
  it("blank Current Borrowings → blocked", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        curlib_borrowing: "",
      })
    ).toThrow(AppError);
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        curlib_borrowing: "",
      })
    ).toThrow("Current Borrowings is required.");
  });

  it("blank Other Current Liabilities → blocked", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        curlib_non_borrowing: "",
      })
    ).toThrow("Other Current Liabilities is required.");
  });

  it("blank Non-current Loans → blocked", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        ncl_loan: "",
      })
    ).toThrow("Non-current Loans is required.");
  });

  it("blank Other Non-current Liabilities → blocked", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        ncl_non_loan: "",
      })
    ).toThrow("Other Non-current Liabilities is required.");
  });

  it("blank Accumulated Profit / (Loss) → blocked", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        equity_accumulated_profit: "",
      })
    ).toThrow("Accumulated Profit / Loss is required.");
  });

  it("blank Operating/Administrative/Interest/Other Costs → blocked", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        operating_cost: "",
      })
    ).toThrow("Operating Costs is required.");
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        admin_cost: "",
      })
    ).toThrow("Administrative Costs is required.");
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        interest_cost: "",
      })
    ).toThrow("Interest Costs is required.");
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        other_cost: "",
      })
    ).toThrow("Other Costs is required.");
  });

  it("blank P&L Minority Interest → blocked", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        pl_minority: "",
      })
    ).toThrow("P&L Minority Interest is required.");
  });

  it("Share Application Account / Share Premium / Equity Minority Interest remain optional (blank allowed)", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        equity_share_application: "",
        equity_share_premium: "",
        equity_minority: "",
      })
    ).not.toThrow();
  });

  it("rejects blank for newly-required core/extra raw money fields", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        cashAndBank: "",
      })
    ).toThrow("Cash & Bank is required.");

    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        annualDebtService: "",
      })
    ).toThrow("Annual Debt Service is required.");
  });

  it("accepts 0 for newly-required numeric fields", () => {
    expect(() =>
      assertRequiredFinancialComrepFieldsPresentOrThrow({
        ...validRequiredBlock(),
        cashAndBank: 0,
        tradeReceivables: 0,
        costOfSales: 0,
        annualDebtService: 0,
      })
    ).not.toThrow();
  });

  it("rejects missing required fields (undefined)", () => {
    const { cashAndBank: _cashAndBank, ...rest } = validRequiredBlock();
    expect(() => assertRequiredFinancialComrepFieldsPresentOrThrow(rest)).toThrow("Cash & Bank is required.");
  });

  it("valid completed year block → allowed", () => {
    expect(() => assertRequiredFinancialComrepFieldsPresentOrThrow(validRequiredBlock())).not.toThrow();
  });
});

