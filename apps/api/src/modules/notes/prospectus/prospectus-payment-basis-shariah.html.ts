/**
 * SECTION: Plain HTML for Payment Basis & Shariah Canva-facing preview
 * WHY: Unstyled Stage 4C — audit / schedule / Tawarruq metadata excluded
 */

import type { ProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusPaymentBasisShariahHtml(
  data: ProspectusPaymentBasisShariah
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Payment Basis and Shariah Principle</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 4C: Payment Basis and Shariah Principle</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>Investment Summary — Payment Basis and Shariah Principle</h2>
    <p>
      Payment Basis: ${escapeHtml(data.paymentBasis)}<br />
      Shariah Principle: ${escapeHtml(data.shariahPrinciple)}
    </p>
  </section>
</body>
</html>`;
}
