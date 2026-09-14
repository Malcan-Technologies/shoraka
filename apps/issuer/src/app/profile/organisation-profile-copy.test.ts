import { readFileSync } from "fs";
import { join } from "path";

const profile = readFileSync(join(__dirname, "page.tsx"), "utf8");
const financials = readFileSync(
  join(__dirname, "../../components/issuer-financials-card.tsx"),
  "utf8"
);
const company = readFileSync(
  join(__dirname, "../../components/issuer-company-details-card.tsx"),
  "utf8"
);

describe("Issuer organisation profile copy", () => {
  it("labels Person in Charge separately from company e-mail", () => {
    expect(profile).toContain('isPersonal ? "Contact details" : "Person in Charge"');
    expect(profile).toContain("Main contact person for this company.");
    expect(profile).not.toContain('missing={missingFieldKeys.has("companyEmail")}');
    expect(profile).toContain('missing={missingFieldKeys.has("contactPersonEmail")}');
    expect(profile).toContain('missing={missingFieldKeys.has("contactPersonName")}');
    expect(profile).toContain('missing={missingFieldKeys.has("contactPersonPosition")}');
    expect(profile).toContain("name: contactName");
    expect(profile).toContain("position: contactPosition");
    expect(profile).not.toContain("Enter all contact details");
    expect(company).not.toContain("companyEmail");
    expect(company).toContain("PROFILE_LABEL.companyPhone");
  });

  it("shows submitted financial history as read-only, not an editable master", () => {
    expect(financials).toContain("Financial Statements");
    expect(financials).toContain("ProfileFinancialHistory");
    expect(financials).toContain("Financial history from submitted financing applications.");
    expect(financials).not.toContain("Enter or update figures");
    expect(financials).toContain("query.data?.financial_statements");
    expect(financials).not.toContain("ctos_financials");
    expect(financials).not.toContain("Complete financials");
    expect(financials).not.toContain("required fields missing");
    expect(financials).not.toContain("<Dialog");
    expect(financials).not.toContain("yearBlock && year");
    expect(financials).not.toContain("isEditing");
    expect(financials).not.toContain("patchIssuerOrgFinancials");
  });

  it("maps Type of Company from the SC enum, not a raw RegTank label", () => {
    expect(company).toContain("displayScCompanyTypeLabel");
  });

  it("marks required company fields without a Profile asterisk", () => {
    expect(company).toContain("required");
    expect(company).toContain('missing={missing.has("scCompanyType")}');
    expect(company).toContain("required\n              missing={missing.has(\"scCompanyType\")}");
    expect(company).not.toContain("text-destructive\">*</");
    expect(company).not.toContain("Please fill up");
  });
});
