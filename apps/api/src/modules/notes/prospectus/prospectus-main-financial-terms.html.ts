/**
 * SECTION: Plain HTML for Main Financial Terms preview
 * WHY: Unstyled Stage 4A proof — no design
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
  const rows: Array<{ key: keyof ProspectusMainFinancialTerms; displayLabel: string }> = [
    { key: "financingAmount", displayLabel: "Financing amount" },
    { key: "minimumInvestment", displayLabel: "Minimum investment" },
    { key: "profitRate", displayLabel: "Profit rate" },
    {
      key: "expectedReturnForInvestmentPeriod",
      displayLabel: "Expected return for investment period",
    },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES[key];
      return `<tr>
  <td>${escapeHtml(displayLabel)}</td>
  <td>${escapeHtml(data[key])}</td>
  <td>${escapeHtml(source.canonicalSource)}</td>
  <td>${escapeHtml(source.availability)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Main Financial Terms</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 4A: Main Financial Terms</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>
    Financing amount: ${escapeHtml(data.financingAmount)}<br />
    Minimum investment: ${escapeHtml(data.minimumInvestment)}<br />
    Profit rate: ${escapeHtml(data.profitRate)}<br />
    Expected return for investment period: ${escapeHtml(data.expectedReturnForInvestmentPeriod)}
  </p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>Label</th>
        <th>Value</th>
        <th>Canonical source</th>
        <th>Availability</th>
      </tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
</body>
</html>`;
}
