/**
 * SECTION: Sample Page 2 Stage 8 CTA / header / footer inputs
 * WHY: Prove official logo + confirmed route; no Canva marketing/legal claims
 */

import { buildProspectusFooter } from "./prospectus-footer";
import { buildProspectusHeader } from "./prospectus-header";
import { buildProspectusInvestmentCta } from "./prospectus-investment-cta";
import type { ProspectusFooter } from "./prospectus-footer.types";
import type { ProspectusHeader } from "./prospectus-header.types";
import type {
  ProspectusInvestmentCta,
  ProspectusInvestmentCtaInput,
} from "./prospectus-investment-cta.types";

/** Deterministic cuid-like Note id for preview path only — not shown as visible text. */
export const SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID = "clsamplepreviewnote001";

export const SAMPLE_PROSPECTUS_INVESTMENT_CTA_INPUT: ProspectusInvestmentCtaInput = {
  noteId: SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID,
  productNameEndingInI: "Accounts Receivable Financing-i",
  marketingParagraph:
    "Invest with confidence in an attractive short-term Shariah-compliant investment.",
};

export const SAMPLE_PROSPECTUS_HEADER: ProspectusHeader = buildProspectusHeader({
  productNameEndingInI: "Accounts Receivable Financing-i",
  tawarruqOrShorakaContext: { product: "Tawarruq / Shoraka" },
  legacyCanvaTagline: "Invest in Growth. Earn with Purpose.",
});

export const SAMPLE_PROSPECTUS_INVESTMENT_CTA: ProspectusInvestmentCta =
  buildProspectusInvestmentCta(SAMPLE_PROSPECTUS_INVESTMENT_CTA_INPUT);

export const SAMPLE_PROSPECTUS_FOOTER: ProspectusFooter = buildProspectusFooter({
  legacyCanvaRiskWarning:
    "Investments are subject to credit risk, default risk, and other risks.",
  legacyCanvaTermsStatement:
    "Investors are advised to read and understand the Product Terms and Risk Disclosure Statement before investing.",
});
