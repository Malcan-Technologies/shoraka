import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("application financial review ROE hint", () => {
  it("shows Net Worth in the Return of Equity formula hint, not Paid-Up Capital", () => {
    const source = readFileSync(
      join(__dirname, "application-financial-review-content.tsx"),
      "utf8"
    );
    expect(source).toContain('formulaHint: "Profit after tax ÷ net worth."');
    expect(source).not.toMatch(/formulaHint:\s*"Profit after tax ÷ paid-up capital\."/);
  });
});
