/**
 * SECTION: Plain HTML for Issuer Track-Record Summary preview
 * WHY: Unstyled Stage 7 proof — no design; no historical table rows
 */

import type { ProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record.types";
import { PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES } from "./prospectus-issuer-track-record.types";

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
  const rows: Array<{ key: keyof ProspectusIssuerTrackRecord; displayLabel: string }> = [
    { key: "issuerIdentitySource", displayLabel: "Issuer identity source" },
    { key: "previousIssuedNotes", displayLabel: "Previous issued notes" },
    { key: "successfullyFundedNotes", displayLabel: "Successfully funded notes" },
    { key: "activeNotes", displayLabel: "Active notes" },
    { key: "fullyRepaidNotes", displayLabel: "Fully repaid notes" },
    { key: "totalHistoricalAmountRaised", displayLabel: "Total historical amount raised" },
    { key: "onTimeRepaymentRate", displayLabel: "On-time repayment rate" },
    { key: "defaultCount", displayLabel: "Default count" },
    { key: "averageInvestorReturn", displayLabel: "Average investor return" },
    { key: "trackRecordSummaryTitle", displayLabel: "Track-record summary title" },
    { key: "trackRecordSummaryExplanation", displayLabel: "Track-record summary explanation" },
    { key: "dataFrozenOnCurrentNote", displayLabel: "Data frozen on current Note" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES[key];
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
  <title>Prospectus Page 1 — Issuer Track-Record Summary</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 7: Issuer Track-Record Summary</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>Detailed historical-note table is out of scope. Issuer dashboard aggregates are not reused as prospectus rules. Current Note must be excluded from any future history totals. Data is not frozen on the Note.</p>
  <p>
    Issuer identity source: ${escapeHtml(data.issuerIdentitySource)}<br />
    Previous issued notes: ${escapeHtml(data.previousIssuedNotes)}<br />
    Successfully funded notes: ${escapeHtml(data.successfullyFundedNotes)}<br />
    Active notes: ${escapeHtml(data.activeNotes)}<br />
    Fully repaid notes: ${escapeHtml(data.fullyRepaidNotes)}<br />
    Total historical amount raised: ${escapeHtml(data.totalHistoricalAmountRaised)}<br />
    On-time repayment rate: ${escapeHtml(data.onTimeRepaymentRate)}<br />
    Default count: ${escapeHtml(data.defaultCount)}<br />
    Average investor return: ${escapeHtml(data.averageInvestorReturn)}<br />
    Track-record summary title: ${escapeHtml(data.trackRecordSummaryTitle)}<br />
    Track-record summary explanation: ${escapeHtml(data.trackRecordSummaryExplanation)}<br />
    Data frozen on current Note: ${escapeHtml(data.dataFrozenOnCurrentNote)}
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
