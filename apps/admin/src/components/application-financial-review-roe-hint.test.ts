import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("application financial review ROE hint", () => {
  it("shows Net Worth in the Return of Equity formula hint, not Paid-Up Capital", () => {
    const source = readFileSync(
      join(__dirname, "application-financial-review-content.tsx"),
      "utf8"
    );
    expect(source).toContain(
      'formulaHint: "CTOS: return_on_equity only. Issuer: PAT ÷ net worth from submitted lines."'
    );
    expect(source).not.toMatch(
      /id: "return_of_equity"[\s\S]*?formulaHint:\s*"Profit after tax ÷ paid-up capital\."/
    );
  });
});
