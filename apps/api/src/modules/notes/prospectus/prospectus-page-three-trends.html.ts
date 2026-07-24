/**
 * SECTION: Plain HTML for Page 3 Stage 5 trends preview
 * WHY: Metric labels + DNA trend only — no arrows, colours, or audit
 */

import type { ProspectusPageThreeTrends } from "./prospectus-page-three-trends.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusPageThreeTrendsHtml(data: ProspectusPageThreeTrends): string {
  const bodyRows = data.trends
    .map(
      (item) =>
        `<tr><th scope="row">${escapeHtml(item.metricLabel)}</th><td>${escapeHtml(
          item.trend
        )}</td></tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 3 — Financial Trends</title>
</head>
<body>
  <h1>Prospectus Page 3 — DATA STAGE 5: Financial Trends</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Trend</th>
        </tr>
      </thead>
      <tbody>
${bodyRows}
      </tbody>
    </table>
  </section>
</body>
</html>`;
}
