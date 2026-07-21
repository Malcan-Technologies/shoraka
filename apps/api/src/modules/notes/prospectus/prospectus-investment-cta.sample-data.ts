/**
 * SECTION: Sample Page 2 Stage 8 CTA / header inputs
 * WHY: Prove static CTA + official logo; no Canva marketing/legal claims
 */

import { buildProspectusHeader } from "./prospectus-header";
import { buildProspectusInvestmentCta } from "./prospectus-investment-cta";
import type { ProspectusHeader } from "./prospectus-header.types";
import type { ProspectusInvestmentCta } from "./prospectus-investment-cta.types";

export const SAMPLE_PROSPECTUS_HEADER: ProspectusHeader = buildProspectusHeader({
  productNameEndingInI: "Accounts Receivable Financing-i",
  tawarruqOrShorakaContext: { product: "Tawarruq / Shoraka" },
  legacyCanvaTagline: "Invest in Growth. Earn with Purpose.",
});

export const SAMPLE_PROSPECTUS_INVESTMENT_CTA: ProspectusInvestmentCta =
  buildProspectusInvestmentCta();
