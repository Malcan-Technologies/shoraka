import { readFileSync } from "fs";
import { join } from "path";

const step = readFileSync(join(__dirname, "company-details-step.tsx"), "utf8");
const editPage = readFileSync(join(__dirname, "../[id]/edit/page.tsx"), "utf8");
const newPage = readFileSync(join(__dirname, "../new/page.tsx"), "utf8");

describe("issuer application company-details profile gate", () => {
  it("requires all four Person in Charge fields from the company profile", () => {
    expect(step).toContain("if (!formState.contactPersonName?.trim())");
    expect(step).toContain("if (!formState.contactPersonEmail?.trim())");
    expect(step).toContain("if (!formState.contactPersonPosition?.trim())");
    expect(step).toContain("if (!formState.contactPersonContact?.trim())");
    expect(step).toContain('fieldErrors.contactPersonName = "Update on company profile"');
    expect(step).toContain('fieldErrors.contactPersonPosition = "Update on company profile"');
    expect(step).toContain("formState.contactPersonName?.trim()");
    expect(step).toContain("formState.contactPersonPosition?.trim()");
  });

  it("does not treat Profile completeness as an application start or submit blocker", () => {
    expect(editPage).toContain("You can continue with your application");
    expect(editPage).toContain("showProfileIncompleteWarning");
    expect(newPage).not.toContain("contactPersonName");
    expect(newPage).not.toContain("profileCompleteness");
  });
});
