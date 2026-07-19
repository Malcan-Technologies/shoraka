/**
 * SECTION: Plain HTML for At a Glance Canva-facing preview
 * WHY: Unstyled Stage 6 — source paths, reuse flags, and audit metadata excluded
 */

import type { ProspectusAtAGlance } from "./prospectus-at-a-glance.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusAtAGlanceHtml(data: ProspectusAtAGlance): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — At a Glance</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 6: At a Glance</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>At a Glance</h2>
    <p>
      Financing Amount: ${escapeHtml(data.financingAmount)}<br />
      Profit Rate (p.a.): ${escapeHtml(data.profitRate)}<br />
      Expected Return: ${escapeHtml(data.expectedReturn)}<br />
      Tenure: ${escapeHtml(data.tenure)}<br />
      Minimum Investment: ${escapeHtml(data.minimumInvestment)}
    </p>
  </section>
</body>
</html>`;
}
