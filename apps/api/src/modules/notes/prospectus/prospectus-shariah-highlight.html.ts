/**
 * SECTION: Plain HTML for Shariah Investor Highlight preview
 * WHY: Unstyled Stage 5D proof — no design
 */

import type { ProspectusShariahHighlight } from "./prospectus-shariah-highlight.types";
import { PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES } from "./prospectus-shariah-highlight.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusShariahHighlightHtml(data: ProspectusShariahHighlight): string {
  const rows: Array<{ key: keyof ProspectusShariahHighlight; displayLabel: string }> = [
    { key: "shariahCompliantStatus", displayLabel: "Shariah-compliant status" },
    { key: "specificShariahPrinciple", displayLabel: "Specific Shariah principle" },
    { key: "evidenceSource", displayLabel: "Evidence source" },
    { key: "approvalOrAdviserReference", displayLabel: "Approval or adviser reference" },
    { key: "highlightTitle", displayLabel: "Highlight title" },
    { key: "highlightExplanation", displayLabel: "Highlight explanation" },
    { key: "claimApprovalStatus", displayLabel: "Claim approval status" },
    { key: "frozenOnNote", displayLabel: "Frozen on Note" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES[key];
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
  <title>Prospectus Page 1 — Shariah Investor Highlight</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 5D: Shariah Investor Highlight</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>Broader \"Shariah-compliant investment\" claim is not Note-level structured data. Distinct from Stage 4C principle field; both unresolved. Tawarruq is not used as prospectus evidence.</p>
  <p>
    Shariah-compliant status: ${escapeHtml(data.shariahCompliantStatus)}<br />
    Specific Shariah principle: ${escapeHtml(data.specificShariahPrinciple)}<br />
    Evidence source: ${escapeHtml(data.evidenceSource)}<br />
    Approval or adviser reference: ${escapeHtml(data.approvalOrAdviserReference)}<br />
    Highlight title: ${escapeHtml(data.highlightTitle)}<br />
    Highlight explanation: ${escapeHtml(data.highlightExplanation)}<br />
    Claim approval status: ${escapeHtml(data.claimApprovalStatus)}<br />
    Frozen on Note: ${escapeHtml(data.frozenOnNote)}
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
