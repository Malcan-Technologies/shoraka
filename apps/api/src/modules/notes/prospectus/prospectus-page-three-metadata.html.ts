/**
 * SECTION: Plain HTML for Page 3 Stage 1 metadata preview
 * WHY: Title, subtitle, metadata strip, year headings only — no metrics/audit
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_METADATA_LABELS,
  type ProspectusPageThreeMetadata,
} from "./prospectus-page-three-metadata.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusPageThreeMetadataHtml(
  data: ProspectusPageThreeMetadata
): string {
  const labels = PROSPECTUS_PAGE_THREE_METADATA_LABELS;
  const yearBlock =
    data.financialYears.length === 0
      ? `<p>Selected financial years: ${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</p>`
      : `<ul>
${data.financialYears
  .map(
    (year) =>
      `  <li>${escapeHtml(year.yearLabel)} — ${escapeHtml(
        year.financialYearEndLabel
      )}</li>`
  )
  .join("\n")}
</ul>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 3 — Detailed Financial Comparison Metadata</title>
</head>
<body>
  <h1>Prospectus Page 3 — DATA STAGE 1: Shared Source + Metadata</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>${escapeHtml(data.pageTitle)}</h2>
    <p>${escapeHtml(data.pageSubtitle)}</p>
    <p>
      ${escapeHtml(labels.sector)}: ${escapeHtml(data.metadata.sector)}<br />
      ${escapeHtml(labels.riskRating)}: ${escapeHtml(data.metadata.riskRating)}<br />
      ${escapeHtml(labels.paymaster)}: ${escapeHtml(data.metadata.paymaster)}<br />
      ${escapeHtml(labels.paymasterGrading)}: ${escapeHtml(data.metadata.paymasterGrading)}<br />
      ${escapeHtml(labels.confidenceGrading)}: ${escapeHtml(data.metadata.confidenceGrading)}
    </p>
    <h3>Selected financial years</h3>
    ${yearBlock}
  </section>
</body>
</html>`;
}
