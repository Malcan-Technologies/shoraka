/**
 * SECTION: Plain HTML for Issuer Financial-Strength Highlight preview
 * WHY: Unstyled Stage 5B proof — no design
 */

import type { ProspectusIssuerFundamentalsHighlight } from "./prospectus-issuer-fundamentals-highlight.types";
import { PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES } from "./prospectus-issuer-fundamentals-highlight.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusIssuerFundamentalsHighlightHtml(
  data: ProspectusIssuerFundamentalsHighlight
): string {
  const rows: Array<{
    key: keyof ProspectusIssuerFundamentalsHighlight;
    displayLabel: string;
  }> = [
    { key: "financialDataSource", displayLabel: "Financial data source" },
    { key: "financialYearsAvailable", displayLabel: "Financial years available" },
    { key: "profitabilityEvidence", displayLabel: "Profitability evidence" },
    { key: "leverageEvidence", displayLabel: "Leverage evidence" },
    { key: "highlightTitle", displayLabel: "Highlight title" },
    { key: "highlightExplanation", displayLabel: "Highlight explanation" },
    { key: "claimApprovalStatus", displayLabel: "Claim approval status" },
    { key: "dataFrozenOnNote", displayLabel: "Data frozen on Note" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES[key];
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
  <title>Prospectus Page 1 — Issuer Financial-Strength Highlight</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 5B: Issuer Financial-Strength Highlight</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>Raw unaudited financials exist on the Application; highlight claims are unresolved. Not frozen on Note.</p>
  <p>
    Financial data source: ${escapeHtml(data.financialDataSource)}<br />
    Financial years available: ${escapeHtml(data.financialYearsAvailable)}<br />
    Profitability evidence: ${escapeHtml(data.profitabilityEvidence)}<br />
    Leverage evidence: ${escapeHtml(data.leverageEvidence)}<br />
    Highlight title: ${escapeHtml(data.highlightTitle)}<br />
    Highlight explanation: ${escapeHtml(data.highlightExplanation)}<br />
    Claim approval status: ${escapeHtml(data.claimApprovalStatus)}<br />
    Data frozen on Note: ${escapeHtml(data.dataFrozenOnNote)}
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
