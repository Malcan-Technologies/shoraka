/**
 * SECTION: Plain HTML for Page 2 Credit Insights preview
 * WHY: Unstyled Canva-facing fields — five rows + static supporting description
 */

import type { ProspectusCreditInsights } from "./prospectus-credit-insights.types";
import { PROSPECTUS_CREDIT_INSIGHTS_DESCRIPTION } from "./prospectus-credit-insights.types";

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
    `MARC Credit Grade: ${escapeHtml(data.marcCreditGrade)}`,
    `MARC Credit Score: ${escapeHtml(data.marcCreditScore)}`,
    `Probability of Default: ${escapeHtml(data.probabilityOfDefault)}`,
    `Litigation Check: ${escapeHtml(data.litigationCheck)}`,
    `CCRIS Status: ${escapeHtml(data.ccrisStatus)}`,
  ];
  const description = escapeHtml(data.description || PROSPECTUS_CREDIT_INSIGHTS_DESCRIPTION);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — Credit Insights</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 5: Credit Insights</h1>
  <p>Unstyled Canva-facing preview. Missing Draft values must be exactly: —. All five rows are mandatory.</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>
      ${lines.join("<br />\n      ")}
    </p>
    <em class="credit-insights-note">${description}</em>
  </section>
</body>
</html>`;
}
