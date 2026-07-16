/**
 * SECTION: Plain HTML for Paymaster Investor Highlight preview
 * WHY: Unstyled Stage 5A proof — no design
 */

import type { ProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight.types";
import { PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES } from "./prospectus-paymaster-highlight.types";

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
  const rows: Array<{ key: keyof ProspectusPaymasterHighlight; displayLabel: string }> = [
    { key: "paymasterName", displayLabel: "Paymaster name" },
    { key: "paymasterEntityType", displayLabel: "Paymaster entity type" },
    { key: "governmentClassification", displayLabel: "Government classification" },
    { key: "paymasterPaymentTrackRecord", displayLabel: "Paymaster payment track record" },
    { key: "highlightTitle", displayLabel: "Highlight title" },
    { key: "highlightExplanation", displayLabel: "Highlight explanation" },
    { key: "claimApprovalStatus", displayLabel: "Claim approval status" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES[key];
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
  <title>Prospectus Page 1 — Paymaster Investor Highlight</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 5A: Paymaster Investor Highlight</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>Name and entity type are frozen Note snapshot fields. Highlight claims are unresolved.</p>
  <p>
    Paymaster name: ${escapeHtml(data.paymasterName)}<br />
    Paymaster entity type: ${escapeHtml(data.paymasterEntityType)}<br />
    Government classification: ${escapeHtml(data.governmentClassification)}<br />
    Paymaster payment track record: ${escapeHtml(data.paymasterPaymentTrackRecord)}<br />
    Highlight title: ${escapeHtml(data.highlightTitle)}<br />
    Highlight explanation: ${escapeHtml(data.highlightExplanation)}<br />
    Claim approval status: ${escapeHtml(data.claimApprovalStatus)}
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
