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
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>${escapeHtml(data.pageTitle)}</h2>
    <p>${escapeHtml(data.pageSubtitle)}</p>
    <div class="meta-strip" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;">
      <div><div>${escapeHtml(labels.sector)}</div><div>${escapeHtml(data.metadata.sector)}</div></div>
      <div><div>${escapeHtml(labels.riskRating)}</div><div>${escapeHtml(data.metadata.riskRating)}</div></div>
      <div><div>${escapeHtml(labels.paymaster)}</div><div>${escapeHtml(data.metadata.paymaster)}</div></div>
      <div><div>${escapeHtml(labels.paymasterGrading)}</div><div>${escapeHtml(data.metadata.paymasterGrading)}</div></div>
      <div><div>${escapeHtml(labels.confidenceGrading)}</div><div>${escapeHtml(data.metadata.confidenceGrading)}</div></div>
    </div>
    <h3>Selected financial years</h3>
    ${yearBlock}
  </section>
</body>
</html>`;
}
