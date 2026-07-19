/**
 * SECTION: Plain HTML for Page 2 Stage 4A financial comparison source preview
 * WHY: Prove year selection/order/FYE — no Stage 4B metric rows
 */

import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-financial-comparison-source.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusFinancialComparisonSourceHtml(
  data: ProspectusFinancialComparisonSource
): string {
  const yearBlock =
    data.years.length === 0
      ? `<p>Financial Years: ${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</p>`
      : `<table border="1" cellpadding="6" cellspacing="0">
  <thead>
    <tr>
${data.years
  .map(
    (year) =>
      `      <th>${escapeHtml(year.yearLabel)}<br /><span>${escapeHtml(
        year.financialYearEndLabel
      )}</span></th>`
  )
  .join("\n")}
    </tr>
  </thead>
  <tbody>
    <tr>
${data.years
  .map(() => `      <td>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</td>`)
  .join("\n")}
    </tr>
  </tbody>
</table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — 3-Year Financial Comparison Source</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 4A: Financial Comparison Source</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>Table Unit Label: ${escapeHtml(data.tableUnitLabel)}</p>
    ${yearBlock}
  </section>
</body>
</html>`;
}
