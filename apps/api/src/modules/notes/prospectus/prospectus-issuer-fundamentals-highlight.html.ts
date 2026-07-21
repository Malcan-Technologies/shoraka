/**
 * SECTION: Plain HTML for Issuer Fundamentals Highlight Canva-facing preview
 * WHY: Unstyled Stage 5B — FS source/years/ratios/audit excluded
 */

import type { ProspectusIssuerFundamentalsHighlight } from "./prospectus-issuer-fundamentals-highlight.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusIssuerFundamentalsHighlightHtml(
  data: ProspectusIssuerFundamentalsHighlight
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Issuer Fundamentals Highlight</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 5B: Issuer Fundamentals Highlight</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>Key Investor Highlights — Issuer Fundamentals</h2>
    <p>
      Profitability Evidence: ${escapeHtml(data.profitabilityEvidence)}<br />
      Leverage Evidence: ${escapeHtml(data.leverageEvidence)}<br />
      Highlight Title: ${escapeHtml(data.highlightTitle)}<br />
      Highlight Explanation: ${escapeHtml(data.highlightExplanation)}
    </p>
  </section>
</body>
</html>`;
}
