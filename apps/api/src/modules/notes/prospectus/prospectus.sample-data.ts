/**
 * SECTION: Static sample data for prospectus page-1 POC
 * WHY: Match Canva page 1 reference without Prisma wiring
 */

import type { ProspectusPage1Data } from "./prospectus.types";

export const SAMPLE_PROSPECTUS_PAGE1_DATA: ProspectusPage1Data = {
  brandName: "CashSouk",
  tagline: "Invest in Growth. Earn with Purpose.",
  complianceBadge: "Shariah Compliant",
  documentTitle: "INVESTMENT NOTE",
  noteReference: "ARF-2505-0187",
  financingTypeLabel: "ACCOUNTS RECEIVABLE FINANCING-i",
  financingTypeBlurb:
    "Helping businesses unlock cash flow through Accounts Receivable (AR) financing.",
  metaItems: [
    { label: "Listing Date", value: "15 May 2025" },
    { label: "Maturity Date", value: "12 September 2025 (120 days)" },
    { label: "Paymaster", value: "Kementerian Kerja Raya (KKR) (Government Agency)" },
  ],
  riskRating: {
    grade: "A-",
    levelLabel: "Low Risk",
    description:
      "Strong paymaster profile with government-linked receivables and solid issuer repayment history on CashSouk.",
    scaleLinkLabel: "See rating scale on page 2",
  },
  investmentSummary: [
    { label: "Financing Amount", value: "RM 500,000" },
    { label: "Minimum Investment", value: "RM 100" },
    { label: "Profit rate", value: "12.0% p.a." },
    { label: "Expected Return", value: "3.95%" },
    { label: "Tenure", value: "120 days" },
    { label: "Maturity Date", value: "12 Sept 2025" },
    { label: "Purpose", value: "Working Capital" },
    { label: "Payment Basis", value: "Bullet Payment" },
    { label: "Shariah Principle", value: "Bai' Al-Dayn Bi Al-Sila'" },
  ],
  keyHighlights: [
    {
      title: "Backed by a strong government paymaster",
      description:
        "Receivables are owed by Kementerian Kerja Raya (KKR), providing a government-linked credit profile for this note.",
    },
    {
      title: "Strong issuer fundamentals",
      description:
        "Issuer has a clean repayment record on CashSouk with consistent on-time settlement across prior notes.",
    },
    {
      title: "Attractive short-term returns",
      description:
        "Investors can target a 12.0% p.a. profit rate over a 120-day tenure with bullet repayment at maturity.",
    },
    {
      title: "Shariah-compliant investment",
      description:
        "Structured under Bai' Al-Dayn Bi Al-Sila' and offered as a Shariah-compliant investment note.",
    },
  ],
  atAGlance: [
    { label: "Profit Rate for Investors", value: "12.0% p.a." },
    { label: "Expected Return", value: "3.95%" },
    { label: "Tenure", value: "120 days" },
    { label: "Minimum Investment", value: "RM 100" },
    { label: "Financing Amount", value: "RM 500,000" },
  ],
  trackRecordHeading: "ISSUER'S TRACK RECORD ON CASH SOUK",
  trackRecordMetrics: [
    { label: "Total Notes Funded", value: "8" },
    { label: "Total Amount Funded", value: "RM 3.45 mil" },
    { label: "Successful Repayment", value: "100%" },
    { label: "On-time Payment Rate", value: "100%" },
  ],
  historicalNotes: [
    {
      noteId: "ARF-2411-0092",
      financingType: "AR Financing-i",
      amountRm: "420,000",
      tenure: "90 days",
      profitRatePa: "11.5%",
      status: "Repaid",
      repaymentDate: "12 Feb 2025",
    },
    {
      noteId: "ARF-2501-0124",
      financingType: "AR Financing-i",
      amountRm: "350,000",
      tenure: "120 days",
      profitRatePa: "12.0%",
      status: "Repaid",
      repaymentDate: "28 Apr 2025",
    },
    {
      noteId: "ARF-2502-0140",
      financingType: "AR Financing-i",
      amountRm: "480,000",
      tenure: "90 days",
      profitRatePa: "11.8%",
      status: "Repaid",
      repaymentDate: "18 May 2025",
    },
    {
      noteId: "ARF-2503-0161",
      financingType: "AR Financing-i",
      amountRm: "510,000",
      tenure: "120 days",
      profitRatePa: "12.0%",
      status: "Repaid",
      repaymentDate: "30 Jun 2025",
    },
  ],
  trackRecordDisclaimer: "Past performance is not indicative of future performance.",
  footerDisclaimer:
    "This Investment Note carries credit and other risks. Investors should read the Product Terms and Risk Disclosure Statement carefully before investing. Capital is at risk and returns are not guaranteed.",
};
