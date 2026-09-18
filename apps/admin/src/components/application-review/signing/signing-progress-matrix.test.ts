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

  it("labels Shoraka signers with a company badge and authorised-signatory or witness title", () => {
    expect(source).toContain("isShorakaSigningRecipient");
    expect(source).toContain("signingRecipientDisplayTitle");
    expect(source).toContain('label="Shoraka"');
    expect(source).toContain("showDot={false}");
  });

  it("keeps signer rows from overflowing or overlapping badges", () => {
    expect(source).toContain("flex min-w-0 flex-wrap");
    expect(source).toContain("min-w-52 flex-1");
    expect(source).toContain("min-w-0 truncate");
    expect(source).toContain('className="shrink-0"');
    expect(source).toContain("ml-auto flex min-w-0 max-w-full flex-wrap");
  });
});
