import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "./portfolio-at-risk-row.tsx"), "utf8");

describe("PortfolioAtRiskRow", () => {
  it("shows cumulative PAR tiles and links to ageing", () => {
    expect(source).toContain('title: "Past due"');
    expect(source).toContain('title: "PAR30"');
    expect(source).toContain('title: "PAR60"');
    expect(source).toContain('title: "PAR90"');
    expect(source).toContain('title: "Defaulted"');
    expect(source).toContain('href="/reports/ageing"');
    expect(source).toContain("DPD > 90");
    expect(source).toContain("ParGauge");
    expect(source).toContain("percent of book");
  });
});
