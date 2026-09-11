import { financialStatementsV2Schema } from "./schemas";
import { mergeIssuerOrgFinancialStatementsFromApplication } from "./issuer-organization-financial-statements";

const questionnaire = { financial_year_end: "2027-12-31" };

function parseApplicationPayload(raw: unknown) {
  const parsed = financialStatementsV2Schema.safeParse(raw);
  expect(parsed.success).toBe(true);
  if (!parsed.success) throw new Error("expected valid application financials");
  return parsed.data;
}

describe("mergeIssuerOrgFinancialStatementsFromApplication", () => {
  it("preserves ComRep liability splits when a thinner application payload only sends curlib", () => {
    const existing = {
      questionnaire,
      unaudited_by_year: {
        "2024": {
          curlib: 10,
          curlib_borrowing: 40,
          curlib_non_borrowing: 15,
          ncl_loan: 80,
          ncl_non_loan: 5,
          turnover: 100,
          operating_cost: 20,
        },
      },
    };
    const incomingRaw = {
      questionnaire,
      unaudited_by_year: {
        "2024": {
          pldd: "2024-12-31",
          bsfatot: 0,
          othass: 0,
          bscatot: 1,
          bsclbank: 2,
          curlib: 99,
          bsslltd: 0,
          bsclstd: 0,
          bsqpuc: 0,
          turnover: 50,
          plnpbt: 3,
          plnpat: 2,
          plnetdiv: 0,
          plyear: 0,
        },
      },
    };
    const merged = mergeIssuerOrgFinancialStatementsFromApplication({
      existing,
      incomingRaw,
      incomingParsed: parseApplicationPayload(incomingRaw),
    });
    const year = (merged.unaudited_by_year as Record<string, Record<string, unknown>>)["2024"];
    expect(year.curlib).toBe(99);
    expect(year.turnover).toBe(50);
    expect(year.plnpbt).toBe(3);
    expect(year.curlib_borrowing).toBe(40);
    expect(year.curlib_non_borrowing).toBe(15);
    expect(year.ncl_loan).toBe(80);
    expect(year.ncl_non_loan).toBe(5);
    expect(year.operating_cost).toBe(20);
    expect(year.curlib_borrowing).not.toBe(year.curlib);
    expect(year.curlib_non_borrowing).not.toBe(year.curlib);
  });

  it("preserves richer P&L master values when the application omits those keys", () => {
    const existing = {
      questionnaire,
      unaudited_by_year: {
        "2024": {
          turnover: 10,
          operating_cost: 4,
          admin_cost: 3,
          interest_cost: 1,
          other_cost: 2,
          pl_minority: 0.5,
          plnpbt: 9,
        },
      },
    };
    const incomingRaw = {
      questionnaire,
      unaudited_by_year: {
        "2024": {
          pldd: "2024-12-31",
          bsfatot: 0,
          othass: 0,
          bscatot: 0,
          bsclbank: 0,
          curlib: 0,
          bsslltd: 0,
          bsclstd: 0,
          bsqpuc: 0,
          turnover: 88,
          plnpbt: 11,
          plnpat: 7,
          plnetdiv: 0,
          plyear: 0,
        },
      },
    };
    const merged = mergeIssuerOrgFinancialStatementsFromApplication({
      existing,
      incomingRaw,
      incomingParsed: parseApplicationPayload(incomingRaw),
    });
    const year = (merged.unaudited_by_year as Record<string, Record<string, unknown>>)["2024"];
    expect(year.turnover).toBe(88);
    expect(year.plnpbt).toBe(11);
    expect(year.operating_cost).toBe(4);
    expect(year.admin_cost).toBe(3);
    expect(year.interest_cost).toBe(1);
    expect(year.other_cost).toBe(2);
    expect(year.pl_minority).toBe(0.5);
  });

  it("updates an exact provided field and leaves unrelated years untouched", () => {
    const existing = {
      questionnaire: { financial_year_end: "2026-12-31" },
      unaudited_by_year: {
        "2023": { equity_share_application: 12, equity_share_premium: 8, equity_minority: 1 },
        "2024": { bsqpuc: 100, equity_accumulated_profit: 25 },
      },
    };
    const incomingRaw = {
      questionnaire,
      unaudited_by_year: {
        "2024": {
          pldd: "2024-12-31",
          bsfatot: 0,
          othass: 0,
          bscatot: 0,
          bsclbank: 0,
          curlib: 0,
          bsslltd: 0,
          bsclstd: 0,
          bsqpuc: 140,
          turnover: 0,
          plnpbt: 0,
          plnpat: 0,
          plnetdiv: 0,
          plyear: 0,
        },
      },
    };
    const merged = mergeIssuerOrgFinancialStatementsFromApplication({
      existing,
      incomingRaw,
      incomingParsed: parseApplicationPayload(incomingRaw),
    });
    const byYear = merged.unaudited_by_year as Record<string, Record<string, unknown>>;
    expect(byYear["2024"].bsqpuc).toBe(140);
    expect(byYear["2024"].equity_accumulated_profit).toBe(25);
    expect(byYear["2023"].equity_share_application).toBe(12);
    expect(byYear["2023"].equity_share_premium).toBe(8);
    expect(byYear["2023"].equity_minority).toBe(1);
    expect(merged.questionnaire).toEqual(questionnaire);
  });

  it("does not invent borrowing/non-borrowing or ncl splits from legacy curlib/bsslltd", () => {
    const incomingRaw = {
      questionnaire,
      unaudited_by_year: {
        "2024": {
          pldd: "2024-12-31",
          bsfatot: 0,
          othass: 0,
          bscatot: 0,
          bsclbank: 0,
          curlib: 70,
          bsslltd: 30,
          bsclstd: 0,
          bsqpuc: 0,
          turnover: 200,
          plnpbt: 0,
          plnpat: 0,
          plnetdiv: 0,
          plyear: 0,
        },
      },
    };
    const merged = mergeIssuerOrgFinancialStatementsFromApplication({
      existing: null,
      incomingRaw,
      incomingParsed: parseApplicationPayload(incomingRaw),
    });
    const year = (merged.unaudited_by_year as Record<string, Record<string, unknown>>)["2024"];
    expect(year.curlib).toBe(70);
    expect(year.bsslltd).toBe(30);
    expect(year.turnover).toBe(200);
    expect(year.curlib_borrowing).toBeUndefined();
    expect(year.curlib_non_borrowing).toBeUndefined();
    expect(year.ncl_loan).toBeUndefined();
    expect(year.ncl_non_loan).toBeUndefined();
  });

  it("persists application ComRep extras into org history when the issuer provided them", () => {
    const incomingRaw = {
      questionnaire,
      unaudited_by_year: {
        "2024": {
          pldd: "2024-12-31",
          bsfatot: 1,
          othass: 0,
          bscatot: 0,
          bsclbank: 0,
          curlib: 70,
          bsslltd: 30,
          bsclstd: 0,
          bsqpuc: 0,
          turnover: 200,
          plnpbt: 0,
          plnpat: 0,
          plnetdiv: 0,
          plyear: 0,
          curlib_borrowing: 55,
          operating_cost: 12,
        },
      },
    };
    const merged = mergeIssuerOrgFinancialStatementsFromApplication({
      existing: {
        questionnaire: { financial_year_end: "2026-12-31" },
        unaudited_by_year: { "2023": { turnover: 9 } },
      },
      incomingRaw,
      incomingParsed: parseApplicationPayload(incomingRaw),
    });
    const byYear = merged.unaudited_by_year as Record<string, Record<string, unknown>>;
    expect(byYear["2024"].curlib).toBe(70);
    expect(byYear["2024"].curlib_borrowing).toBe(55);
    expect(byYear["2024"].operating_cost).toBe(12);
    expect(byYear["2023"].turnover).toBe(9);
  });
});
