/**
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { join } from "path";

const label = readFileSync(join(__dirname, "comrep-field-label.tsx"), "utf8");
const readField = readFileSync(join(__dirname, "components/profile-read-field.tsx"), "utf8");
const financials = readFileSync(join(__dirname, "profile-financial-statements.tsx"), "utf8");

describe("Profile required/optional convention", () => {
  it("does not render asterisks on ComRepFieldLabel", () => {
    expect(label).not.toMatch(/<span[^>]*>\s*\*\s*</);
    expect(label).not.toContain("text-destructive\">*</");
    expect(label).toContain("Optional");
    expect(label).toContain("showOptional");
  });

  it("does not show Optional or Required in read mode", () => {
    expect(readField).toContain("promptRequiredEmpty ? PROFILE_REQUIRED_EMPTY_LABEL");
    expect(readField).toContain("Requiredness from completeness/validators");
    expect(readField).not.toContain(">Optional<");
    expect(readField).not.toContain("text-status-action-text\">Required");
    expect(readField).not.toContain("text-destructive\">*");
  });

  it("edits financial statements in place with Optional only on optional keys", () => {
    expect(financials).toContain("profileFinancialFieldLabel(key, true)");
    expect(financials).toContain("optional={!required}");
    expect(financials).toContain("isIssuerFinancialFieldRequired");
    expect(financials).not.toContain("<Dialog");
    expect(financials).not.toContain("Assets|");
    expect(financials).not.toContain("Equity|");
    expect(financials).not.toContain("Liabilities|");
  });
});
