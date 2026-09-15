import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("issuer signing progress matrix", () => {
  const source = readFileSync(join(__dirname, "signing-progress-matrix.tsx"), "utf8");

  it("shows CashSouk waiting state and never reminds automatic recipients", () => {
    expect(source).toContain("automaticSigningProgressBadge");
    expect(source).toContain("isRemindableSigningRecipient");
    expect(source).toContain('recipient.execution_mode === "AUTOMATIC"');
    expect(source).toContain("!isAutomatic &&");
  });
});
