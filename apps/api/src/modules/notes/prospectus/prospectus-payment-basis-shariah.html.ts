/**
 * SECTION: Plain HTML for Payment Basis & Shariah preview
 * WHY: Unstyled Stage 4C proof — no design
 */

import type { ProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah.types";
import { PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES } from "./prospectus-payment-basis-shariah.types";

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
  const rows: Array<{ key: keyof ProspectusPaymentBasisShariah; displayLabel: string }> = [
    { key: "paymentBasis", displayLabel: "Payment basis" },
    { key: "shariahPrinciple", displayLabel: "Shariah principle" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES[key];
      return `<tr>
  <td>${escapeHtml(displayLabel)}</td>
  <td>${escapeHtml(data[key])}</td>
  <td>${escapeHtml(source.canonicalSource)}</td>
  <td>${escapeHtml(source.availability)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Payment Basis and Shariah Principle</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 4C: Payment Basis and Shariah Principle</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>Neither field has a confirmed stored source. Do not use Canva sample wording.</p>
  <p>
    Payment basis: ${escapeHtml(data.paymentBasis)}<br />
    Shariah principle: ${escapeHtml(data.shariahPrinciple)}
  </p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>Label</th>
        <th>Value</th>
        <th>Canonical source</th>
        <th>Availability</th>
      </tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
</body>
</html>`;
}
