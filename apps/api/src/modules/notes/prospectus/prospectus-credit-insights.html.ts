/**
 * SECTION: Plain HTML for Page 2 Credit Insights preview
 * WHY: Unstyled Canva-facing fields only — all five rows always rendered; no footer
 */

import type { ProspectusCreditInsights } from "./prospectus-credit-insights.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusCreditInsightsHtml(data: ProspectusCreditInsights): string {
  const lines = [
    `Credit Score: ${escapeHtml(data.creditScore)}`,
    `Payment Behaviour: ${escapeHtml(data.paymentBehaviour)}`,
    `Credit Utilisation: ${escapeHtml(data.creditUtilisation)}`,
    `Litigation Check: ${escapeHtml(data.litigationCheck)}`,
    `CCRIS Status: ${escapeHtml(data.ccrisStatus)}`,
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — Credit Insights</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 5: Credit Insights</h1>
  <p>Unstyled Canva-facing preview. Missing Draft values must be exactly: Data not available. No footer. All five rows are mandatory.</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>
      ${lines.join("<br />\n      ")}
    </p>
  </section>
</body>
</html>`;
}
