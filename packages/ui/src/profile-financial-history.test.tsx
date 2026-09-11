/**
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
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
  curlib: 40,
  bsslltd: 10,
  bsclstd: 5,
  bsqpuc: 80,
  turnover: 200,
  plnpbt: 15,
  plnpat: 12,
  plnetdiv: 1,
  plyear: 12,
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
  pl_minority: 0.5,
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
    expect(html).toContain("Financial statements");
    expect(html).toContain("Additional financial details");
    expect(html).toContain("For regulatory reporting");
    for (const key of APPLICATION_CORE_MONEY_KEYS) {
      expect(htmlHasText(html, FINANCIAL_FIELD_LABELS[key] ?? key)).toBe(true);
      expect(html).toContain(formatProfileRmAmount(fy2027Block[key]));
    }
    for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
      expect(htmlHasText(html, FINANCIAL_FIELD_LABELS[key] ?? key)).toBe(true);
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
