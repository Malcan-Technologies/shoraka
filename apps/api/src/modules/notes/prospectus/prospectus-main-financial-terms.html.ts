/**
 * SECTION: Plain HTML for Main Financial Terms Canva-facing preview
 * WHY: Unstyled Stage 4A — audit metadata excluded from this document
 */

import type { ProspectusMainFinancialTerms } from "./prospectus-main-financial-terms.types";
import { PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES } from "./prospectus-main-financial-terms.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusMainFinancialTermsHtml(
  data: ProspectusMainFinancialTerms
): string {
  const financingSrc = PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.financingAmount;
  const minSrc = PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.minimumInvestment;
  const rateSrc = PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.profitRate;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Main Financial Terms</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 4A: Main Financial Terms</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <p>
    Canonical sources:
    ${escapeHtml(financingSrc.canonicalSource)};
    ${escapeHtml(minSrc.canonicalSource)};
    ${escapeHtml(rateSrc.canonicalSource)} (annual gross before fees).
    Expected period return has no approved formula.
  </p>
  <section>
    <h2>Investment Summary</h2>
    <p>
      Financing Amount: ${escapeHtml(data.financingAmount)}<br />
      Minimum Investment: ${escapeHtml(data.minimumInvestment)}<br />
      Profit Rate (p.a.): ${escapeHtml(data.profitRate)}<br />
      Expected Return for Investment Period: ${escapeHtml(data.expectedReturnForInvestmentPeriod)}
    </p>
  </section>
</body>
</html>`;
}
