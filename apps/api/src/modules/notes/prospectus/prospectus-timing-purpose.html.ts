/**
 * SECTION: Plain HTML for Timing & Purpose Canva-facing preview
 * WHY: Unstyled Stage 4B — audit metadata excluded; closes_at stays in Stage 2
 */

import type { ProspectusTimingPurpose } from "./prospectus-timing-purpose.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusTimingPurposeHtml(data: ProspectusTimingPurpose): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Timing and Purpose</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 4B: Timing and Purpose</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>Investment Summary — Timing and Purpose</h2>
    <p>
      Tenure: ${escapeHtml(data.tenure)}<br />
      Maturity Date: ${escapeHtml(data.maturityDate)}<br />
      Purpose of Financing: ${escapeHtml(data.purposeOfFinancing)}
    </p>
  </section>
</body>
</html>`;
}
