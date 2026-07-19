/**
 * SECTION: Plain HTML for Shariah Investor Highlight Canva-facing preview
 * WHY: Unstyled Stage 5D — Tawarruq/ops/audit/claim-approval metadata excluded
 */

import type { ProspectusShariahHighlight } from "./prospectus-shariah-highlight.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusShariahHighlightHtml(data: ProspectusShariahHighlight): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Shariah Investor Highlight</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 5D: Shariah Investor Highlight</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>Key Investor Highlights — Shariah</h2>
    <p>
      Shariah-Compliant Status: ${escapeHtml(data.shariahCompliantStatus)}<br />
      Shariah Principle: ${escapeHtml(data.specificShariahPrinciple)}<br />
      Evidence Source: ${escapeHtml(data.evidenceSource)}<br />
      Adviser or Approval Reference: ${escapeHtml(data.approvalOrAdviserReference)}<br />
      Highlight Title: ${escapeHtml(data.highlightTitle)}<br />
      Highlight Explanation: ${escapeHtml(data.highlightExplanation)}
    </p>
  </section>
</body>
</html>`;
}
