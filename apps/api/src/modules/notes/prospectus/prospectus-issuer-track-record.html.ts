/**
 * SECTION: Plain HTML for Issuer Track-Record Canva-facing preview
 * WHY: Heading + four metrics; audit/filters/dashboard metadata excluded
 */

import type { ProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusIssuerTrackRecordHtml(
  data: ProspectusIssuerTrackRecord
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Issuer Track-Record Summary</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 7: Issuer Track-Record Summary</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>
      Total Notes Funded: ${escapeHtml(data.totalNotesFunded)}<br />
      Total Amount Funded: ${escapeHtml(data.totalAmountFunded)}<br />
      Successful Repayment: ${escapeHtml(data.successfulRepayment)}<br />
      ${escapeHtml(data.onTimePaymentRateLabel)}: ${escapeHtml(data.onTimePaymentRate)}
    </p>
  </section>
</body>
</html>`;
}
