/**
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
  APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
  FINANCIAL_FIELD_LABELS,
  formatProfileRmAmount,
} from "@cashsouk/types";
import { ProfileFinancialHistory, ProfileFinancialYearDetails } from "./profile-financial-statements";

const source = readFileSync(join(__dirname, "profile-financial-statements.tsx"), "utf8");

const fy2027Block: Record<string, unknown> = {
  bsfatot: 100,
  othass: 20,
  bscatot: 50,
  bsclbank: 30,
  cashAndBank: 10,
  tradeReceivables: 5,
  curlib: 40,
  bsslltd: 10,
  bsclstd: 5,
  bsqpuc: 80,
  turnover: 200,
  grossProfit: 30,
  ebitda: 25,
  plnpbt: 15,
  plnpat: 12,
  plnetdiv: 1,
  netOperatingIncome: 18,
  plyear: 12,
  tradePayables: 7,
  curlib_borrowing: 25,
  curlib_non_borrowing: 15,
  ncl_loan: 8,
  ncl_non_loan: 2,
  equity_share_application: 3,
  equity_share_premium: 4,
  equity_accumulated_profit: 6,
  equity_minority: 0,
  operating_cost: 70,
  admin_cost: 11,
  interest_cost: 2,
  other_cost: 1,
  // Fixture includes a negative P&L minority interest; ensure formatting survives.
  pl_minority: -8975580,
  costOfSales: 140,
  operatingCashFlow: 160,
  freeCashFlow: 170,
  annualDebtService: 220,
};

const years = [
  { year: "2025", block: { turnover: 9 } },
  { year: "2027", block: fy2027Block },
  { year: "2026", block: { turnover: 10 } },
];

function fieldLabels(keys: readonly string[]): string[] {
  return keys.map((key) => FINANCIAL_FIELD_LABELS[key] ?? key);
}

function htmlHasText(html: string, text: string): boolean {
  return html.includes(text.replace(/&/g, "&amp;"));
}

describe("ProfileFinancialHistory", () => {
  it("lists every stored FY newest first and keeps details collapsed", () => {
    const html = renderToStaticMarkup(<ProfileFinancialHistory years={years} />);
    expect(html.indexOf("FY2027")).toBeLessThan(html.indexOf("FY2026"));
    expect(html.indexOf("FY2026")).toBeLessThan(html.indexOf("FY2025"));
    expect(html).toContain("FY2027");
    expect(html).toContain("FY2026");
    expect(html).toContain("FY2025");
    expect(html).toContain("Submitted financial record");
    expect(html).toContain("View details");
    expect(html).not.toContain("Hide details");
    for (const label of fieldLabels(APPLICATION_CORE_MONEY_KEYS)) {
      expect(htmlHasText(html, label)).toBe(false);
    }
    for (const label of fieldLabels(APPLICATION_COMREP_DETAIL_KEYS)) {
      expect(htmlHasText(html, label)).toBe(false);
    }
  });

  it("does not show edit controls or application completeness warnings", () => {
    const html = renderToStaticMarkup(<ProfileFinancialHistory years={years} />);
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain("required");
    expect(html).not.toContain("incomplete");
    expect(html).not.toContain("fields missing");
    expect(html).not.toContain("N fields missing");
    expect(source).toContain("useState<string | null>(null)");
    expect(source).toContain('expanded ? "Hide details" : "View details"');
    expect(source).toContain("setExpandedYear(expanded ? null : year)");
  });
});

describe("ProfileFinancialYearDetails", () => {
  it("preserves every core financial field and ComRep additional field", () => {
    const html = renderToStaticMarkup(<ProfileFinancialYearDetails block={fy2027Block} />);

    // Category headers (new hierarchy)
    expect(html).toContain("Assets");
    expect(html).toContain("Liabilities");
    expect(html).toContain("Equity");
    expect(htmlHasText(html, "Profit & Loss")).toBe(true);
    expect(html).toContain("Costs");
    expect(html).toContain("Cash Flow / Debt");

    // Optional markers: only these 3 equity raw fields.
    expect(html).toContain("Share Application Account (if applicable)");
    expect(htmlHasText(html, "Share Premium & Other Reserves (if applicable)")).toBe(true);
    expect(html).toContain("Equity Minority Interest (if applicable)");
    expect(html).not.toContain("Cash & Bank (if applicable)");
    expect(html).not.toContain("Trade Receivables (if applicable)");

    // Label overrides must align with the Admin Financial Review wording.
    expect(html).toContain("Paid-up Share Capital");
    expect(html).toContain("Revenue / Turnover");
    expect(html).toContain("Profit / Loss Before Tax");
    expect(html).toContain("Profit / Loss After Tax");
    expect(html).toContain("Profit / Loss of Year");

    // Still preserves every stored raw field value + its label.
    for (const key of [...APPLICATION_CORE_MONEY_KEYS, ...APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS]) {
      const label = key === "bsqpuc"
        ? "Paid-up Share Capital"
        : key === "turnover"
          ? "Revenue / Turnover"
          : key === "plnpbt"
            ? "Profit / Loss Before Tax"
            : key === "plnpat"
              ? "Profit / Loss After Tax"
              : key === "plyear"
                ? "Profit / Loss of Year"
                : FINANCIAL_FIELD_LABELS[key] ?? key;
      expect(htmlHasText(html, label)).toBe(true);
      expect(html).toContain(formatProfileRmAmount(fy2027Block[key]));
    }

    for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
      const labelBase = FINANCIAL_FIELD_LABELS[key] ?? key;
      const label = ["equity_share_application", "equity_share_premium", "equity_minority"].includes(key)
        ? `${labelBase} (if applicable)`
        : labelBase;
      expect(htmlHasText(html, label)).toBe(true);
      expect(html).toContain(formatProfileRmAmount(fy2027Block[key]));
    }
  });

  it("renders missing values as an em dash", () => {
    const html = renderToStaticMarkup(
      <ProfileFinancialYearDetails block={{ bsfatot: 1, turnover: null }} />
    );
    expect(html).toContain(formatProfileRmAmount(1));
    expect(html).toContain("—");
    expect(html).not.toContain("required");
    expect(html).not.toContain("fields missing");
  });
});
