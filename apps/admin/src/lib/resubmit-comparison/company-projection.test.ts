import type { ReviewApplicationView } from "@/components/application-review/section-content";
import { comparisonRowDiffers } from "./projection-types";
import { companyComparisonHasChanges, projectCompanyComparison } from "./company-projection";

function bank(accountNumber: string) {
  return {
    content: [
      { fieldName: "Bank", fieldValue: "Maybank" },
      { fieldName: "Bank account number", fieldValue: accountNumber },
    ],
  };
}

function app(overrides: {
  org?: Record<string, unknown> | null;
  companyDetails?: Record<string, unknown>;
} = {}): ReviewApplicationView {
  const org =
    overrides.org === null
      ? null
      : {
          id: "org-1",
          name: "Acme Sdn Bhd",
          corporate_onboarding_data: {
            basicInfo: { businessName: "Acme Sdn Bhd", entityType: "Private Limited", industry: "Retail" },
            addresses: { business: { line1: "1 Jalan A", city: "KL" } },
            aboutYourBusiness: { whatDoesCompanyDo: "Trading", singleCustomerOver50Revenue: false },
          },
          bank_account_details: bank("1234567890"),
          ...(overrides.org ?? {}),
        };
  return {
    issuer_organization: org as ReviewApplicationView["issuer_organization"],
    company_details: {
      contact_person: { name: "Ali", email: "ali@acme.test", position: "CFO", contact: "0123" },
      ...(overrides.companyDetails ?? {}),
    },
  };
}

function changedRowLabels(before: ReviewApplicationView, after: ReviewApplicationView): string[] {
  return projectCompanyComparison(before, after)
    .flatMap((b) => b.rows)
    .filter(comparisonRowDiffers)
    .map((r) => r.label);
}

describe("projectCompanyComparison", () => {
  it("renders the five live blocks in live order with the bank account hint", () => {
    const blocks = projectCompanyComparison(app(), app());
    expect(blocks.map((b) => b.title)).toEqual([
      "Company Info",
      "About Your Business",
      "Address",
      "Banking Details",
      "Contact Person",
    ]);
    const accountRow = blocks[3]!.rows.find((r) => r.label === "Bank Account Number");
    expect(accountRow).toMatchObject({ kind: "text", hint: "10–18 digits", after: "1234567890" });
    expect(companyComparisonHasChanges(app(), app())).toBe(false);
  });

  it("issuer_organization bank account change is a visible Company diff", () => {
    const after = app({ org: { bank_account_details: bank("9999999999") } });
    expect(companyComparisonHasChanges(app(), after)).toBe(true);
    expect(changedRowLabels(app(), after)).toEqual(["Bank Account Number"]);
  });

  it("non-contact keys in company_details never count", () => {
    const after = app({ companyDetails: { last_saved_at: "2026-01-01", draft_flag: true } });
    expect(companyComparisonHasChanges(app(), after)).toBe(false);
  });

  it("contact person change is a visible diff", () => {
    const after = app({
      companyDetails: { contact_person: { name: "Abu", email: "ali@acme.test", position: "CFO", contact: "0123" } },
    });
    expect(changedRowLabels(app(), after)).toEqual(["Applicant Name"]);
  });

  it("null issuer_organization on both sides shows empty rows without a diff", () => {
    const before = app({ org: null });
    const after = app({ org: null });
    expect(companyComparisonHasChanges(before, after)).toBe(false);
    const nameRow = projectCompanyComparison(before, after)[0]!.rows[0]!;
    expect(nameRow).toMatchObject({ before: "Not provided", after: "Not provided" });
  });

  it("missing before organization against a populated after organization differs", () => {
    expect(companyComparisonHasChanges(app({ org: null }), app())).toBe(true);
  });

  it("empty-looking values compare equal (— vs Not provided)", () => {
    const before = app({ org: { name: "" , corporate_onboarding_data: { basicInfo: { businessName: "" } } } });
    const after = app({ org: { name: null, corporate_onboarding_data: { basicInfo: {} } } });
    expect(companyComparisonHasChanges(before, after)).toBe(false);
  });

  describe("SSM No source (same fall-through as the admin organization detail API)", () => {
    function withBasicInfo(basicInfo: Record<string, unknown>): ReviewApplicationView {
      return app({
        org: {
          corporate_onboarding_data: {
            basicInfo: { businessName: "Acme Sdn Bhd", ...basicInfo },
          },
        },
      });
    }
    const ssmRow = (before: ReviewApplicationView, after: ReviewApplicationView) =>
      projectCompanyComparison(before, after)[0]!.rows.find((r) => r.key === "ssm_no")!;

    it("only ssmRegistrationNumber present shows the value", () => {
      const a = withBasicInfo({ ssmRegistrationNumber: "202501998877" });
      expect(ssmRow(a, a)).toMatchObject({ before: "202501998877", after: "202501998877" });
    });

    it("both keys present: ssmRegisterNumber wins", () => {
      const a = withBasicInfo({ ssmRegisterNumber: "111", ssmRegistrationNumber: "222" });
      expect(ssmRow(a, a)).toMatchObject({ after: "111" });
    });

    it("empty ssmRegisterNumber falls through to ssmRegistrationNumber", () => {
      const a = withBasicInfo({ ssmRegisterNumber: "", ssmRegistrationNumber: "202501998877" });
      expect(ssmRow(a, a)).toMatchObject({ after: "202501998877" });
    });

    it("same SSM stored under different key names Before/After is not a Diff", () => {
      const before = withBasicInfo({ ssmRegisterNumber: "202501998877" });
      const after = withBasicInfo({ ssmRegistrationNumber: "202501998877" });
      expect(comparisonRowDiffers(ssmRow(before, after))).toBe(false);
      expect(companyComparisonHasChanges(before, after)).toBe(false);
    });

    it("different SSM values make only the SSM row differ and Company Diff", () => {
      const before = withBasicInfo({ ssmRegistrationNumber: "202501998877" });
      const after = withBasicInfo({ ssmRegistrationNumber: "202501990000" });
      expect(changedRowLabels(before, after)).toEqual(["SSM No"]);
      expect(companyComparisonHasChanges(before, after)).toBe(true);
    });
  });
});
