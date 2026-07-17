/**
 * SECTION: Plain HTML for At a Glance preview
 * WHY: Unstyled Stage 6 proof — no design
 */

import type { ProspectusAtAGlance } from "./prospectus-at-a-glance.types";
import { PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES } from "./prospectus-at-a-glance.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusAtAGlanceHtml(data: ProspectusAtAGlance): string {
  const rows: Array<{ key: keyof ProspectusAtAGlance }> = [
    { key: "financingAmount" },
    { key: "profitRate" },
    { key: "expectedReturn" },
    { key: "tenure" },
    { key: "minimumInvestment" },
  ];

  const body = rows
    .map(({ key }) => {
      const source = PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES[key];
      return `<tr>
  <td>${escapeHtml(source.displayLabel)}</td>
  <td>${escapeHtml(data[key])}</td>
  <td>${escapeHtml(source.canonicalSource)}</td>
  <td>${escapeHtml(source.reusedFrom)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — At a Glance</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 6: At a Glance</h1>
  <p>Unstyled data preview. Composes Stage 4A + Stage 2. Missing values must be exactly: Data not available</p>
  <p>Label notes: use Profit rate (p.a.) for annual gross before fees (not an after-fee investor net label). Use singular Expected return for the unresolved period metric.</p>
  <p>
    Financing amount: ${escapeHtml(data.financingAmount)}<br />
    Profit rate: ${escapeHtml(data.profitRate)}<br />
    Expected return: ${escapeHtml(data.expectedReturn)}<br />
    Tenure: ${escapeHtml(data.tenure)}<br />
    Minimum investment: ${escapeHtml(data.minimumInvestment)}
  </p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>Label</th>
        <th>Value</th>
        <th>Canonical source</th>
        <th>Reused from</th>
      </tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
</body>
</html>`;
}
