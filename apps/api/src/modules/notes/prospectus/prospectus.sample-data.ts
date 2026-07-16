/**
 * SECTION: Static sample data for prospectus Stage 1 + legacy page-1 POC
 * WHY: Prove Stage 1 labels/values without Prisma; values mirror real field semantics
 */

import type { ProspectusPage1Data, ProspectusStage1Terms } from "./prospectus.types";

/**
 * Stage 1 sample values shaped like real Note data (not Canva ARF branding).
 * Gaps use explicit placeholder text so missing fields are visible in HTML preview.
 */
export const SAMPLE_PROSPECTUS_STAGE1_TERMS: ProspectusStage1Terms = {
  noteReference: "NOTE-20250515-0187ABCD",
  financingType: "Accounts Receivable Financing-i",
  listingDate: "15 May 2025",
  maturityDate: "12 September 2025",
  paymaster: "Kementerian Kerja Raya (KKR) (Government Agency)",
  financingAmount: "RM 500,000.00",
  minimumInvestment: "RM 100.00",
  profitRate: "12.0% p.a.",
  // Period GROSS ≈ 12 * 120/365 ≈ 3.95% (Canva). API DTO uses annual NET instead.
  expectedReturn: "3.95% (period gross; see source notes)",
  tenure: "120 days",
  purposeOfFinancing: "[MISSING — Application.business_details.financing_for]",
  paymentBasis: "Bullet Payment [INFERRED — single maturity schedule]",
  shariahPrinciple: "[UNRESOLVED — not in schema; Canva: Bai' Al-Dayn Bi Al-Sila']",
};

/** @deprecated Prefer SAMPLE_PROSPECTUS_STAGE1_TERMS for Stage 1 work. */
export const SAMPLE_PROSPECTUS_PAGE1_DATA: ProspectusPage1Data = {
  brandName: "CashSouk",
  tagline: "Invest in Growth. Earn with Purpose.",
  complianceBadge: "Shariah Compliant",
  documentTitle: "INVESTMENT NOTE",
  noteReference: SAMPLE_PROSPECTUS_STAGE1_TERMS.noteReference,
  financingTypeLabel: SAMPLE_PROSPECTUS_STAGE1_TERMS.financingType.toUpperCase(),
  financingTypeBlurb:
    "Helping businesses unlock cash flow through Accounts Receivable (AR) financing.",
  metaItems: [
    { label: "Listing Date", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.listingDate },
    {
      label: "Maturity Date",
      value: `${SAMPLE_PROSPECTUS_STAGE1_TERMS.maturityDate} (${SAMPLE_PROSPECTUS_STAGE1_TERMS.tenure})`,
    },
    { label: "Paymaster", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.paymaster },
  ],
  riskRating: {
    grade: "A-",
    levelLabel: "Low Risk",
    description:
      "Strong paymaster profile with government-linked receivables and solid issuer repayment history on CashSouk.",
    scaleLinkLabel: "See rating scale on page 2",
  },
  investmentSummary: [
    { label: "Financing Amount", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.financingAmount },
    { label: "Minimum Investment", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.minimumInvestment },
    { label: "Profit rate", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.profitRate },
    { label: "Expected Return", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.expectedReturn },
    { label: "Tenure", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.tenure },
    { label: "Maturity Date", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.maturityDate },
    { label: "Purpose", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.purposeOfFinancing },
    { label: "Payment Basis", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.paymentBasis },
    { label: "Shariah Principle", value: SAMPLE_PROSPECTUS_STAGE1_TERMS.shariahPrinciple },
  ],
  keyHighlights: [],
  atAGlance: [],
  trackRecordHeading: "ISSUER'S TRACK RECORD ON CASH SOUK",
  trackRecordMetrics: [],
  historicalNotes: [],
  trackRecordDisclaimer: "Past performance is not indicative of future performance.",
  footerDisclaimer:
    "This Investment Note carries credit and other risks. Investors should read the Product Terms and Risk Disclosure Statement carefully before investing. Capital is at risk and returns are not guaranteed.",
};
