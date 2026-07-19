/**
 * SECTION: Plain HTML for Page 2 SoukScore Risk Rating Scale preview
 * WHY: Unstyled Canva-facing structure only — audit/config paths excluded
 */

import type { ProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusSoukscoreRatingScaleHtml(
  data: ProspectusSoukscoreRatingScale
): string {
  const gradeRows = data.grades
    .map((item) => {
      const selectedAttr = item.isSelected ? "true" : "false";
      const selectedClass = item.isSelected ? " is-selected" : "";
      return `    <li class="grade-item${selectedClass}" data-grade="${escapeHtml(item.grade)}" data-selected="${selectedAttr}">
      <span class="grade">${escapeHtml(item.grade)}</span>
      <span class="risk-label">Risk Label: ${escapeHtml(item.riskLabel)}</span>
      <span class="definition">Definition: ${escapeHtml(item.definition)}</span>
    </li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — SoukScore Risk Rating Scale</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 7: SoukScore Risk Rating Scale</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>Assessment Note: ${escapeHtml(data.assessmentNote)}</p>
    <ol class="soukscore-grades">
${gradeRows}
    </ol>
  </section>
</body>
</html>`;
}
