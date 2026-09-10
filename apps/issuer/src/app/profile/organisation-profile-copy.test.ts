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
    expect(company).not.toContain("companyEmail");
    expect(company).toContain("Company phone");
  });

  it("uses Edit financials and does not invent a financial year on the card", () => {
    expect(financials).toContain("Edit financials");
    expect(financials).not.toContain("Complete financials");
    expect(financials).toContain("yearBlock && year");
  });

  it("maps Type of Company from the SC enum, not a raw RegTank label", () => {
    expect(company).toContain("displayScCompanyTypeLabel");
  });
});
