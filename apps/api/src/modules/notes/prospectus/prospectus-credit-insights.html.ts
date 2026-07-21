/**
 * SECTION: Plain HTML for Page 2 Credit Insights preview
 * WHY: Unstyled Canva-facing fields only — omitted fields skipped; no footer / explanation
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
  const omitted = new Set(data.omittedFields);
  const lines: string[] = [];
  if (!omitted.has("creditScore")) {
    lines.push(`Credit Score: ${escapeHtml(data.creditScore)}`);
  }
  if (!omitted.has("paymentBehaviour")) {
    lines.push(`Payment Behaviour: ${escapeHtml(data.paymentBehaviour)}`);
  }
  if (!omitted.has("creditUtilisation")) {
    lines.push(`Credit Utilisation: ${escapeHtml(data.creditUtilisation)}`);
  }
  if (!omitted.has("litigationCheck")) {
    lines.push(`Litigation Check: ${escapeHtml(data.litigationCheck)}`);
  }
  if (!omitted.has("ccrisStatus")) {
    lines.push(`CCRIS Status: ${escapeHtml(data.ccrisStatus)}`);
  }

  const body =
    lines.length > 0
      ? `<p>\n      ${lines.join("<br />\n      ")}\n    </p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — Credit Insights</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 5: Credit Insights</h1>
  <p>Unstyled Canva-facing preview. Missing Draft values must be exactly: Data not available. No footer.</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    ${body}
  </section>
</body>
</html>`;
}
