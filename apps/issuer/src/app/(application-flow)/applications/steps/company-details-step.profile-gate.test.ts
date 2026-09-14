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

  it("blocks the company step when Company Activities or main customers are missing on profile", () => {
    expect(step).toContain("if (!formState.whatDoesCompanyDo.trim())");
    expect(step).toContain("if (!formState.mainCustomers.trim())");
    expect(step).toContain("isAboutYourBusinessComplete");
    expect(step).toContain('fieldErrors.whatDoesCompanyDo = "Update on company profile"');
    expect(step).toContain('fieldErrors.mainCustomers = "Update on company profile"');
  });

  it("does not block the company step on optional About fields", () => {
    expect(step).not.toContain("fieldErrors.singleCustomerOver50Revenue");
    expect(step).not.toContain("fieldErrors.accountingSoftware");
    expect(step).not.toContain("if (formState.singleCustomerOver50Revenue === null)");
    expect(step).not.toContain("if (!formState.accountingSoftware.trim())");
  });

  it("does not treat Profile completeness as an application start or submit blocker", () => {
    expect(editPage).toContain("You can continue with your application");
    expect(editPage).toContain("showProfileIncompleteWarning");
    expect(newPage).not.toContain("contactPersonName");
    expect(newPage).not.toContain("profileCompleteness");
  });
});
