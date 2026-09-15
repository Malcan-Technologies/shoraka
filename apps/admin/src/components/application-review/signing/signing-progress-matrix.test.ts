import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin signing progress matrix", () => {
  const source = readFileSync(join(__dirname, "signing-progress-matrix.tsx"), "utf8");

  it("shows CashSouk waiting state, auto-sign errors, and a retry action", () => {
    expect(source).toContain("automaticSigningProgressBadge");
    expect(source).toContain("auto_sign_error");
    expect(source).toContain("onRetryAutoSign");
    expect(source).toContain("Retry");
    expect(source).toContain("isRemindableSigningRecipient");
    expect(source).toContain("!isAutomatic &&");
  });
});
