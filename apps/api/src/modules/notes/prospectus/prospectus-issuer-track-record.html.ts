/**
 * SECTION: Plain HTML for Issuer Track-Record Canva-facing preview
 * WHY: Heading + four metrics; audit/filters/dashboard metadata excluded
 */

import {
  PROSPECTUS_SUCCESSFUL_REPAYMENT_LABEL,
  PROSPECTUS_TOTAL_AMOUNT_FUNDED_LABEL,
  PROSPECTUS_TOTAL_NOTES_FUNDED_LABEL,
  type ProspectusIssuerTrackRecord,
} from "./prospectus-issuer-track-record.types";

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
      ${escapeHtml(PROSPECTUS_TOTAL_NOTES_FUNDED_LABEL)}: ${escapeHtml(data.totalNotesFunded)}<br />
      ${escapeHtml(PROSPECTUS_TOTAL_AMOUNT_FUNDED_LABEL)}: ${escapeHtml(data.totalAmountFunded)}<br />
      ${escapeHtml(PROSPECTUS_SUCCESSFUL_REPAYMENT_LABEL)}: ${escapeHtml(data.successfulRepayment)}<br />
      ${escapeHtml(data.onTimePaymentRateLabel)}: ${escapeHtml(data.onTimePaymentRate)}
    </p>
  </section>
</body>
</html>`;
}
