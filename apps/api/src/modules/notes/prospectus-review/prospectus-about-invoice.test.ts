/**
 * About the Invoice / Work Performed — Canva templates + Note-token suggestions.
 */

import {
  PROSPECTUS_ABOUT_INVOICE_ITEM_IDS,
  PROSPECTUS_ABOUT_INVOICE_TEMPLATES,
  PROSPECTUS_ABOUT_INVOICE_TRUST_ACCOUNT_REQUIRES_OPS_CONFIRMATION,
  buildProspectusAboutInvoiceRecommendations,
  resolveAboutInvoicePaymasterName,
  resolveAboutInvoicePaymasterShortName,
  resolveAboutInvoiceWorkDescription,
} from "@cashsouk/types";
import {
  emptyProspectusReviewContent,
  normalizeAboutInvoiceSelections,
  toProspectusPublicationContent,
} from "./prospectus-review-content";
import { validateApprovalContent } from "./prospectus-review.schemas";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";

const PAYMASTER = {
  name: "Demo Paymaster Sdn. Bhd.",
  short_name: "Demo Paymaster",
  entity_type: "Private Limited Company (Sdn Bhd)",
};

describe("prospectus about invoice (Canva templates)", () => {
  it("uses exact Canva template wording with Paymaster and work description tokens", () => {
    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: PAYMASTER,
      purposeSnapshot: { financing_for: "bridge repair works" },
      deedOfAssignment: "Yes",
    });
    expect(suggestions.work_under_contract.text).toBe(
      "The issuer has completed bridge repair works under a contract awarded by Demo Paymaster Sdn. Bhd."
    );
    expect(suggestions.certification_acceptance.text).toBe(
      "The invoice represents payment for works certified and accepted by Demo Paymaster."
    );
    expect(suggestions.paymaster_trust_account.text).toBe(
      PROSPECTUS_ABOUT_INVOICE_TEMPLATES.paymaster_trust_account
    );
    expect(suggestions.deed_of_assignment.text).toBe(
      PROSPECTUS_ABOUT_INVOICE_TEMPLATES.deed_of_assignment
    );
  });

  it("prefers invoice/contract description over purpose for workDescription", () => {
    expect(
      resolveAboutInvoiceWorkDescription({
        invoiceSnapshot: { details: { description: "invoice works A" } },
        contractSnapshot: { contract_details: { description: "contract works B" } },
        purposeSnapshot: { financing_for: "purpose works C" },
      })
    ).toBe("invoice works A");
    expect(
      resolveAboutInvoiceWorkDescription({
        contractSnapshot: { contract_details: { description: "contract works B" } },
        purposeSnapshot: { financing_for: "purpose works C" },
      })
    ).toBe("contract works B");
    expect(
      resolveAboutInvoiceWorkDescription({
        purposeSnapshot: { financing_for: "purpose works C" },
      })
    ).toBe("purpose works C");
  });

  it("uses approved short Paymaster name when present, otherwise full name", () => {
    expect(resolveAboutInvoicePaymasterName(PAYMASTER)).toBe("Demo Paymaster Sdn. Bhd.");
    expect(resolveAboutInvoicePaymasterShortName(PAYMASTER)).toBe("Demo Paymaster");
    expect(
      resolveAboutInvoicePaymasterShortName({ name: "Full Paymaster Name Only" })
    ).toBe("Full Paymaster Name Only");
  });

  it("avoids double period when Paymaster name already ends with a period", () => {
    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: { name: "Acme Holdings Sdn. Bhd." },
      purposeSnapshot: { financing_for: "maintenance works" },
    });
    expect(suggestions.work_under_contract.text).toBe(
      "The issuer has completed maintenance works under a contract awarded by Acme Holdings Sdn. Bhd."
    );
    expect(suggestions.work_under_contract.text).not.toMatch(/\.\.$/);
  });

  it("does not hardcode Kementerian Kerja Raya or KKR and never exposes issuer identity", () => {
    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: PAYMASTER,
      purposeSnapshot: { financing_for: "road resurfacing works" },
      deedOfAssignment: "Yes",
    });
    const joined = Object.values(suggestions)
      .map((s) => s.text)
      .join("\n");
    expect(joined).not.toMatch(/Kementerian Kerja Raya/i);
    expect(joined).not.toMatch(/\bKKR\b/);
    expect(joined).not.toMatch(/Sdn Bhd —/);
    expect(joined).not.toMatch(/registration/i);
    expect(joined).not.toMatch(/\d{12}/);
    expect(joined).not.toMatch(/SoukScore|AAA|BBB|gearing|turnover|PAT/i);
  });

  it("prefills DOA suggestion only when DOA selection is Yes", () => {
    const withDoa = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: PAYMASTER,
      purposeSnapshot: { financing_for: "works" },
      deedOfAssignment: "Yes",
    });
    expect(withDoa.deed_of_assignment.text).toBe(
      PROSPECTUS_ABOUT_INVOICE_TEMPLATES.deed_of_assignment
    );

    for (const deedOfAssignment of [null, "No", undefined] as const) {
      const without = buildProspectusAboutInvoiceRecommendations({
        paymasterSnapshot: PAYMASTER,
        purposeSnapshot: { financing_for: "works" },
        deedOfAssignment,
      });
      expect(without.deed_of_assignment.text).toBe("");
    }
  });

  it("regenerates untouched SYSTEM_SUGGESTION text but preserves OFFICER_ENTERED", () => {
    const base = emptyProspectusReviewContent(
      {},
      {
        paymasterSnapshot: PAYMASTER,
        purposeSnapshot: { financing_for: "original works" },
        deedOfAssignment: "Yes",
      }
    );
    base.page2.invoicePaymaster = {
      ...base.page2.invoicePaymaster,
      deedOfAssignment: "Yes",
    };
    base.page2.aboutInvoice = {
      items: [
        {
          id: "work_under_contract",
          text: "Ops confirmed custom work statement.",
          sourceType: "OFFICER_ENTERED",
        },
        {
          id: "certification_acceptance",
          text: "Old suggestion text",
          sourceType: "SYSTEM_SUGGESTION",
        },
        {
          id: "paymaster_trust_account",
          text: PROSPECTUS_ABOUT_INVOICE_TEMPLATES.paymaster_trust_account,
          sourceType: "SYSTEM_SUGGESTION",
        },
        {
          id: "deed_of_assignment",
          text: PROSPECTUS_ABOUT_INVOICE_TEMPLATES.deed_of_assignment,
          sourceType: "SYSTEM_SUGGESTION",
        },
      ],
    };

    const normalized = normalizeAboutInvoiceSelections(base, {
      paymasterSnapshot: PAYMASTER,
      purposeSnapshot: { financing_for: "updated works" },
      deedOfAssignment: "Yes",
    });
    const byId = new Map(normalized.page2.aboutInvoice!.items.map((i) => [i.id, i]));

    expect(byId.get("work_under_contract")).toEqual({
      id: "work_under_contract",
      text: "Ops confirmed custom work statement.",
      sourceType: "OFFICER_ENTERED",
    });
    expect(byId.get("certification_acceptance")?.sourceType).toBe("SYSTEM_SUGGESTION");
    expect(byId.get("certification_acceptance")?.text).toContain("Demo Paymaster");
    expect(byId.get("certification_acceptance")?.text).not.toBe("Old suggestion text");
  });

  it("clears SYSTEM_SUGGESTION DOA text when DOA is No", () => {
    const draft = emptyProspectusReviewContent(
      {},
      {
        paymasterSnapshot: PAYMASTER,
        purposeSnapshot: { financing_for: "works" },
        deedOfAssignment: "Yes",
      }
    );
    draft.page2.invoicePaymaster = {
      ...draft.page2.invoicePaymaster,
      deedOfAssignment: "No",
    };
    const normalized = normalizeAboutInvoiceSelections(draft, {
      paymasterSnapshot: PAYMASTER,
      purposeSnapshot: { financing_for: "works" },
      deedOfAssignment: "No",
    });
    expect(
      normalized.page2.aboutInvoice?.items.find((i) => i.id === "deed_of_assignment")
    ).toEqual({
      id: "deed_of_assignment",
      text: "",
      sourceType: "SYSTEM_SUGGESTION",
    });
  });

  it("flags trust-account sentence as requiring Ops confirmation (no coded universal rule)", () => {
    expect(PROSPECTUS_ABOUT_INVOICE_TRUST_ACCOUNT_REQUIRES_OPS_CONFIRMATION).toBe(true);
  });

  it("publishes officer text and requires non-empty aboutInvoice for approval", () => {
    const draft = buildCompleteProspectusReviewDraft();
    const publication = toProspectusPublicationContent(draft);
    expect(publication.invoiceWorkStatements).toHaveLength(4);
    expect(publication.invoiceWorkStatements.every((s) => s.isVisible && s.text.trim())).toBe(
      true
    );
    expect(publication.invoiceWorkStatements[0]?.text).toContain(
      "civil engineering and infrastructure works"
    );
    expect(publication.invoiceWorkStatements[0]?.text).toContain("Demo Paymaster Sdn. Bhd.");
    expect(publication.invoiceWorkStatements[0]?.text).not.toMatch(/Kementerian Kerja Raya/i);

    const emptyDoa = buildCompleteProspectusReviewDraft();
    emptyDoa.page2.aboutInvoice = {
      items: PROSPECTUS_ABOUT_INVOICE_ITEM_IDS.map((id) => ({
        id,
        text: "",
        sourceType: "SYSTEM_SUGGESTION" as const,
      })),
    };
    expect(
      validateApprovalContent(emptyDoa).some((e) => e.path.includes("aboutInvoice"))
    ).toBe(true);
  });
});
