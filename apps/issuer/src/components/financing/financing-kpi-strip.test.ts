import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "./financing-kpi-strip.tsx"), "utf8");

describe("FinancingKpiTile", () => {
  it("does not wrap ReactNode values in a paragraph", () => {
    expect(source).toContain("{value}");
    expect(source).toMatch(/<div\s+className=\{cn\(\s+"min-w-0 truncate text-xl/);
    expect(source).not.toMatch(/<p\s+className=\{cn\(\s+"min-w-0 truncate text-xl/);
  });
});
