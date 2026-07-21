/**
 * SECTION: Plain HTML for Return Investor Highlight Canva-facing preview
 * WHY: Unstyled Stage 5C — formulas, fee rate, date-basis, and claims audit excluded
 */

import type { ProspectusReturnHighlight } from "./prospectus-return-highlight.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusReturnHighlightHtml(data: ProspectusReturnHighlight): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Return Investor Highlight</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 5C: Return Investor Highlight</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>Key Investor Highlights — Return</h2>
    <p>
      Annual Gross Profit Rate: ${escapeHtml(data.annualGrossProfitRate)}<br />
      Tenure: ${escapeHtml(data.tenure)}<br />
      Annual Net Expected Return Rate (p.a.): ${escapeHtml(data.annualNetExpectedReturnRate)}<br />
      Expected Return (p.a.): ${escapeHtml(data.expectedReturnForInvestmentPeriod)}<br />
      Return Classification: ${escapeHtml(data.returnClassification)}<br />
      Tenure Classification: ${escapeHtml(data.tenureClassification)}<br />
      Highlight Title: ${escapeHtml(data.highlightTitle)}<br />
      Highlight Explanation: ${escapeHtml(data.highlightExplanation)}
    </p>
  </section>
</body>
</html>`;
}
