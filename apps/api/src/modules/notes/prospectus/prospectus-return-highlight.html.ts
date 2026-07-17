/**
 * SECTION: Plain HTML for Return Investor Highlight preview
 * WHY: Unstyled Stage 5C proof — no design
 */

import type { ProspectusReturnHighlight } from "./prospectus-return-highlight.types";
import { PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES } from "./prospectus-return-highlight.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusReturnHighlightHtml(data: ProspectusReturnHighlight): string {
  const rows: Array<{ key: keyof ProspectusReturnHighlight; displayLabel: string }> = [
    { key: "annualGrossProfitRate", displayLabel: "Annual gross profit rate" },
    { key: "tenure", displayLabel: "Tenure" },
    { key: "netOrAfterFeeRate", displayLabel: "Net or after-fee rate" },
    { key: "returnClassification", displayLabel: "Return classification" },
    { key: "tenureClassification", displayLabel: "Tenure classification" },
    { key: "highlightTitle", displayLabel: "Highlight title" },
    { key: "highlightExplanation", displayLabel: "Highlight explanation" },
    { key: "claimApprovalStatus", displayLabel: "Claim approval status" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES[key];
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
  <title>Prospectus Page 1 — Return Investor Highlight</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 5C: Return Investor Highlight</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>Gross rate is before fees. Marketplace does not advertise the gross rate as after fees. Highlight claims are unresolved.</p>
  <p>
    Annual gross profit rate: ${escapeHtml(data.annualGrossProfitRate)}<br />
    Tenure: ${escapeHtml(data.tenure)}<br />
    Net or after-fee rate: ${escapeHtml(data.netOrAfterFeeRate)}<br />
    Return classification: ${escapeHtml(data.returnClassification)}<br />
    Tenure classification: ${escapeHtml(data.tenureClassification)}<br />
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
