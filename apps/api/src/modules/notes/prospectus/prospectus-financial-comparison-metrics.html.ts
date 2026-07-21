/**
 * SECTION: Plain HTML for Page 2 Stage 4 financial comparison (4A years + 4B metrics)
 * WHY: One section renderer; audit/source paths excluded
 */

import type { ProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-financial-comparison-metrics.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusFinancialComparisonMetricsHtml(
  data: ProspectusFinancialComparisonMetrics
): string {
  const yearHeaders =
    data.years.length === 0
      ? `<th>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</th>`
      : data.years
          .map(
            (year) =>
              `<th>${escapeHtml(year.yearLabel)}<br /><span>${escapeHtml(
                year.financialYearEndLabel
              )}</span></th>`
          )
          .join("");

  const bodyRows =
    data.years.length === 0
      ? data.rows
          .map(
            (row) =>
              `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(
                PROSPECTUS_DATA_NOT_AVAILABLE
              )}</td></tr>`
          )
          .join("\n")
      : data.rows
          .map((row) => {
            const cells = row.values
              .map((value) => `<td>${escapeHtml(value)}</td>`)
              .join("");
            return `<tr><th scope="row">${escapeHtml(row.label)}</th>${cells}</tr>`;
          })
          .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — 3-Year Financial Comparison Metrics</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 4B: Financial Comparison Metrics</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Metric</th>
          ${yearHeaders}
        </tr>
      </thead>
      <tbody>
${bodyRows}
      </tbody>
    </table>
    <p>${escapeHtml(data.sourceFooter)}</p>
  </section>
</body>
</html>`;
}
