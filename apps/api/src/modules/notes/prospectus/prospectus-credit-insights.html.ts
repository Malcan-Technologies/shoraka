/**
 * SECTION: Plain HTML for Page 2 Credit Insights preview
 * WHY: Unstyled Canva-facing fields only — audit/raw credit paths excluded
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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — Credit Insights</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 5: Credit Insights</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>
      Credit Score: ${escapeHtml(data.creditScore)}<br />
      Payment Behaviour: ${escapeHtml(data.paymentBehaviour)}<br />
      Credit Utilisation: ${escapeHtml(data.creditUtilisation)}<br />
      Litigation Check: ${escapeHtml(data.litigationCheck)}<br />
      CCRIS Status: ${escapeHtml(data.ccrisStatus)}<br />
      Credit Score Explanation: ${escapeHtml(data.creditScoreExplanation)}
    </p>
  </section>
</body>
</html>`;
}
