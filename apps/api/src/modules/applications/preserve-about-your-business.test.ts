import { preserveLegacyAboutYourBusinessFields } from "./preserve-about-your-business";

describe("preserveLegacyAboutYourBusinessFields", () => {
  it("copies about_your_business and accounting software when the payload omits them", () => {
    const preserved = preserveLegacyAboutYourBusinessFields(
      {
        why_raising_funds: { financing_for: "Working capital" },
        declaration_confirmed: true,
      },
      {
        why_raising_funds: { financing_for: "Working capital" },
        declaration_confirmed: true,
      },
      {
        about_your_business: { what_does_company_do: "Makes parts" },
        why_raising_funds: { accounting_software: "Xero" },
      }
    );
    expect(preserved.about_your_business).toEqual({ what_does_company_do: "Makes parts" });
    expect((preserved.why_raising_funds as Record<string, unknown>).accounting_software).toBe("Xero");
    expect((preserved.why_raising_funds as Record<string, unknown>).financing_for).toBe("Working capital");
  });

  it("does not overwrite when the payload still includes the keys", () => {
    const preserved = preserveLegacyAboutYourBusinessFields(
      {
        about_your_business: { what_does_company_do: "" },
        why_raising_funds: { accounting_software: "" },
      },
      {
        about_your_business: { what_does_company_do: "" },
        why_raising_funds: { accounting_software: "" },
      },
      {
        about_your_business: { what_does_company_do: "Makes parts" },
        why_raising_funds: { accounting_software: "Xero" },
      }
    );
    expect(preserved.about_your_business).toEqual({ what_does_company_do: "" });
    expect((preserved.why_raising_funds as Record<string, unknown>).accounting_software).toBe("");
  });
});
