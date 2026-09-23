import fs from "node:fs";
import path from "node:path";
import { parseCtosReportXml } from "../../modules/ctos/parser";

import {
  buildScenario02CtosRowsFromFixture,
  buildStoredFinancialBlock,
  valuesForYear,
} from "../../../scripts/seed-financial-fallback-scenarios";

describe("seed: financial-fallback-scenarios scenario 02 fixture preservation", () => {
  const fixturePath = path.join(
    __dirname,
    "../../ctos-test/output/2026-09-07T05-14-25-245Z_company_200501525124.xml"
  );

  it("fixture parser keeps the required ComRep raw fields (bsqres/bsqupro/bsqmint/plminin) + return_on_equity", async () => {
    const xml = fs.readFileSync(fixturePath, "utf8");
    const parsed = await parseCtosReportXml(xml);
    const required = ["return_on_equity", "bsqres", "bsqupro", "bsqmint", "plminin"] as const;
    for (const fy of [2023, 2024]) {
      const row = parsed.financials_json.find((r) => r?.financial_year === fy);
      expect(row?.account).toBeTruthy();
      for (const key of required) {
        const v = (row!.account as any)[key];
        expect(v).not.toBeNull();
        expect(v === "").toBe(false);
        expect(Number.isFinite(Number(v))).toBe(true);
      }
      // Explicitly ensure negatives survive for plminin.
      expect((row!.account as any).plminin).toBeLessThan(0);
      expect((row!.account as any).return_on_equity).toBeGreaterThan(0);
    }
  });

  it("scenario 02 CTOS rows built from fixture preserve the required account fields", async () => {
    const xml = fs.readFileSync(fixturePath, "utf8");
    const parsed = await parseCtosReportXml(xml);
    const fixtureRows = parsed.financials_json;

    const rows = buildScenario02CtosRowsFromFixture({ fixtureRows, fyYears: [2023, 2024] });
    expect(rows).toHaveLength(2);

    for (const row of rows) {
      const account = row.account as any;
      expect(account.return_on_equity).not.toBeNull();
      expect(account.bsqres).not.toBeNull();
      expect(account.bsqupro).not.toBeNull();
      expect(account.bsqmint).not.toBeNull();
      expect(account.plminin).not.toBeNull();
      expect(account.plminin).toBeLessThan(0);
    }
  });

  it("FY2026 stored financial block includes the 3 equity fields + pl_minority (raw user input keys)", () => {
    const fy = 2026;
    const v = valuesForYear(fy, 1);
    const block = buildStoredFinancialBlock({ fyEndYear: fy, ...v });

    // Raw user input keys (CashSouk names)
    expect(block.equity_share_premium).not.toBeNull();
    expect(block.equity_accumulated_profit).not.toBeNull();
    expect(block.equity_minority).not.toBeNull();
    expect(block.pl_minority).not.toBeNull();
    expect(Number.isFinite(Number(block.equity_share_premium))).toBe(true);
    expect(Number.isFinite(Number(block.equity_accumulated_profit))).toBe(true);
    expect(Number.isFinite(Number(block.equity_minority))).toBe(true);
    expect(Number.isFinite(Number(block.pl_minority))).toBe(true);
  });
});

