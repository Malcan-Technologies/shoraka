/**
 * About the Invoice / Work Performed — authoritative Canva prefills.
 */

import {
  PROSPECTUS_ABOUT_INVOICE_CERTIFICATION_REQUIRES_OPS_CONFIRMATION,
  PROSPECTUS_ABOUT_INVOICE_ITEM_IDS,
  PROSPECTUS_ABOUT_INVOICE_TEMPLATES,
  PROSPECTUS_ABOUT_INVOICE_TRUST_ACCOUNT_REQUIRES_OPS_CONFIRMATION,
  PROSPECTUS_ABOUT_INVOICE_WORK_COMPLETION_REQUIRES_OPS_CONFIRMATION,
  buildProspectusAboutInvoiceRecommendations,
  resolveAboutInvoicePaymasterName,
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
  entity_type: "Private Limited Company (Sdn Bhd)",
};

const CONTRACT = {
  contract_details: {
    description: "bridge repair works",
  },
};

describe("prospectus about invoice (authoritative sources)", () => {
  it("uses contract description and full Paymaster name in Canva Statement 1 and 2", () => {
    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: PAYMASTER,
      contractSnapshot: CONTRACT,
      deedOfAssignment: "Yes",
    });
    expect(suggestions.work_under_contract.text).toBe(
      "The issuer has completed bridge repair works under a contract awarded by Demo Paymaster Sdn. Bhd."
    );
    expect(suggestions.certification_acceptance.text).toBe(
      "The invoice represents payment for works certified and accepted by Demo Paymaster Sdn. Bhd."
    );
    expect(suggestions.paymaster_trust_account.text).toBe(
      PROSPECTUS_ABOUT_INVOICE_TEMPLATES.paymaster_trust_account
    );
    expect(suggestions.deed_of_assignment.text).toBe(
      PROSPECTUS_ABOUT_INVOICE_TEMPLATES.deed_of_assignment
    );
  });

  it("reads work description only from contract_details.description", () => {
    expect(resolveAboutInvoiceWorkDescription(CONTRACT)).toBe("bridge repair works");
    expect(
      resolveAboutInvoiceWorkDescription({
        description: "top-level contract description ignored",
        contract_details: { description: "authoritative scope" },
      })
    ).toBe("authoritative scope");
  });

  it("ignores invoice description, top-level contract description, and financing purpose", () => {
    expect(
      resolveAboutInvoiceWorkDescription({
        description: "legacy top-level description",
        contract_details: {},
      })
    ).toBe("");
    expect(
      resolveAboutInvoiceWorkDescription({
        details: { description: "invoice remarks ignored" },
        financing_for: "Working capital financing",
        contract_details: { description: "" },
      })
    ).toBe("");

    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: PAYMASTER,
      contractSnapshot: {
        description: "legacy top-level description",
        contract_details: {},
      },
      deedOfAssignment: "Yes",
    });
    expect(suggestions.work_under_contract.text).toBe("");
    expect(suggestions.work_under_contract.text).not.toContain("legacy top-level");
    expect(suggestions.work_under_contract.text).not.toContain("Working capital");
  });

  it("leaves Statement 1 empty when contract description is missing", () => {
    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: PAYMASTER,
      contractSnapshot: { contract_details: { value: 100 } },
      deedOfAssignment: "Yes",
    });
    expect(suggestions.work_under_contract.text).toBe("");
    expect(suggestions.certification_acceptance.text).toContain("Demo Paymaster Sdn. Bhd.");
  });

  it("uses full Paymaster name only and ignores speculative short-name fields", () => {
    expect(resolveAboutInvoicePaymasterName(PAYMASTER)).toBe("Demo Paymaster Sdn. Bhd.");
    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: {
        name: "Full Paymaster Name Sdn. Bhd.",
        short_name: "Short",
        shortName: "CamelShort",
        approved_short_name: "ApprovedShort",
        abbreviation: "ABB",
      },
      contractSnapshot: CONTRACT,
    });
    expect(suggestions.work_under_contract.text).toContain("Full Paymaster Name Sdn. Bhd.");
    expect(suggestions.certification_acceptance.text).toBe(
      "The invoice represents payment for works certified and accepted by Full Paymaster Name Sdn. Bhd."
    );
    expect(suggestions.certification_acceptance.text).not.toContain("Short");
    expect(suggestions.certification_acceptance.text).not.toContain("CamelShort");
    expect(suggestions.certification_acceptance.text).not.toContain("ApprovedShort");
    expect(suggestions.certification_acceptance.text).not.toContain("ABB");
    expect(suggestions.certification_acceptance.text).not.toMatch(/\bFPN\b/);
  });

  it("leaves Statement 2 empty when Paymaster name is missing", () => {
    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: {},
      contractSnapshot: CONTRACT,
    });
    expect(suggestions.work_under_contract.text).toBe("");
    expect(suggestions.certification_acceptance.text).toBe("");
  });

  it("does not invent abbreviations or expose issuer identity / financial metrics", () => {
    const suggestions = buildProspectusAboutInvoiceRecommendations({
      paymasterSnapshot: PAYMASTER,
      contractSnapshot: CONTRACT,
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
    expect(
      buildProspectusAboutInvoiceRecommendations({
        paymasterSnapshot: PAYMASTER,
        contractSnapshot: CONTRACT,
        deedOfAssignment: "Yes",
      }).deed_of_assignment.text
    ).toBe(PROSPECTUS_ABOUT_INVOICE_TEMPLATES.deed_of_assignment);

    for (const deedOfAssignment of [null, "No", undefined] as const) {
      expect(
        buildProspectusAboutInvoiceRecommendations({
          paymasterSnapshot: PAYMASTER,
          contractSnapshot: CONTRACT,
          deedOfAssignment,
        }).deed_of_assignment.text
      ).toBe("");
    }
  });

  it("regenerates untouched SYSTEM_SUGGESTION text but preserves OFFICER_ENTERED", () => {
    const base = emptyProspectusReviewContent(
      {},
      {
        paymasterSnapshot: PAYMASTER,
        contractSnapshot: { contract_details: { description: "original works" } },
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
      contractSnapshot: { contract_details: { description: "updated works" } },
      deedOfAssignment: "Yes",
    });
    const byId = new Map(normalized.page2.aboutInvoice!.items.map((i) => [i.id, i]));

    expect(byId.get("work_under_contract")).toEqual({
      id: "work_under_contract",
      text: "Ops confirmed custom work statement.",
      sourceType: "OFFICER_ENTERED",
    });
    expect(byId.get("certification_acceptance")?.sourceType).toBe("SYSTEM_SUGGESTION");
    expect(byId.get("certification_acceptance")?.text).toContain("Demo Paymaster Sdn. Bhd.");
    expect(byId.get("certification_acceptance")?.text).not.toBe("Old suggestion text");
  });

  it("clears SYSTEM_SUGGESTION DOA text when DOA is No", () => {
    const draft = emptyProspectusReviewContent(
      {},
      {
        paymasterSnapshot: PAYMASTER,
        contractSnapshot: CONTRACT,
        deedOfAssignment: "Yes",
      }
    );
    draft.page2.invoicePaymaster = {
      ...draft.page2.invoicePaymaster,
      deedOfAssignment: "No",
    };
    const normalized = normalizeAboutInvoiceSelections(draft, {
      paymasterSnapshot: PAYMASTER,
      contractSnapshot: CONTRACT,
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

  it("flags work, certification, and trust-account sentences for Ops confirmation", () => {
    expect(PROSPECTUS_ABOUT_INVOICE_WORK_COMPLETION_REQUIRES_OPS_CONFIRMATION).toBe(true);
    expect(PROSPECTUS_ABOUT_INVOICE_CERTIFICATION_REQUIRES_OPS_CONFIRMATION).toBe(true);
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
    expect(publication.invoiceWorkStatements[1]?.text).toContain("Demo Paymaster Sdn. Bhd.");
    expect(publication.invoiceWorkStatements[0]?.text).not.toMatch(/Working capital/i);

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
