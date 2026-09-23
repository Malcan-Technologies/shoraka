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

  it("Share Application Account / Share Premium / Balance Sheet Minority Interest remain optional (blank allowed)", () => {
    expect(() => assertRequiredFinancialComrepFieldsPresentOrThrow(validRequiredBlock())).not.toThrow();
  });

  it("valid completed year block → allowed", () => {
    expect(() => assertRequiredFinancialComrepFieldsPresentOrThrow(validRequiredBlock())).not.toThrow();
  });
});

