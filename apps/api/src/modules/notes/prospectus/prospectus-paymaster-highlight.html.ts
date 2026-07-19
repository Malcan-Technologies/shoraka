/**
 * SECTION: Plain HTML for Paymaster Investor Highlight Canva-facing preview
 * WHY: Unstyled Stage 5A — audit metadata excluded
 */

import type { ProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusPaymasterHighlightHtml(
  data: ProspectusPaymasterHighlight
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Paymaster Investor Highlight</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 5A: Paymaster Investor Highlight</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>Key Investor Highlights — Paymaster</h2>
    <p>
      Paymaster Name: ${escapeHtml(data.paymasterName)}<br />
      Paymaster Entity Type: ${escapeHtml(data.paymasterEntityType)}<br />
      Government Classification: ${escapeHtml(data.governmentClassification)}<br />
      Paymaster Payment Track Record: ${escapeHtml(data.paymasterPaymentTrackRecord)}<br />
      Highlight Title: ${escapeHtml(data.highlightTitle)}<br />
      Highlight Explanation: ${escapeHtml(data.highlightExplanation)}
    </p>
  </section>
</body>
</html>`;
}
