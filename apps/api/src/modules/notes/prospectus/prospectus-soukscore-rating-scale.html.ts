/**
 * SECTION: Plain HTML for Page 2 SoukScore Risk Rating Scale
 * WHY: Horizontal AAA–B scale; selected grade only; no DNA labels/notes
 */

import { escapeHtml } from "./prospectus-html";
import type { ProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale.types";

/** Shared section markup used by stage preview and full Page 2 assembly. */
export function buildProspectusSoukscoreRatingScaleSectionHtml(
  data: ProspectusSoukscoreRatingScale
): string {
  const gradeCells = data.grades
    .map((item) => {
      const selectedAttr = item.isSelected ? "true" : "false";
      const selectedClass = item.isSelected ? " is-selected" : "";
      const ariaCurrent = item.isSelected ? ' aria-current="true"' : "";
      return `    <li class="grade-item${selectedClass}" data-grade="${escapeHtml(
        item.grade
      )}" data-selected="${selectedAttr}"${ariaCurrent}>
      <span class="grade">${escapeHtml(item.grade)}</span>
    </li>`;
    })
    .join("\n");

  const missing =
    data.missingRatingMessage != null
      ? `\n  <p class="soukscore-missing">${escapeHtml(data.missingRatingMessage)}</p>`
      : "";

  return `<section data-stage="7" data-soukscore-scale-version="${escapeHtml(
    data.scaleVersion
  )}">
  <h2>${escapeHtml(data.sectionHeading)}</h2>
  <ol class="soukscore-scale" aria-label="${escapeHtml(data.sectionHeading)}">
${gradeCells}
  </ol>${missing}
</section>`;
}

export function buildProspectusSoukscoreRatingScaleHtml(
  data: ProspectusSoukscoreRatingScale
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — SoukScore Risk Rating Scale</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #111;
      background: #fff;
    }
    h1, h2 { margin: 0 0 8px; font-weight: 700; }
    h2 { font-size: 13px; }
    .soukscore-scale {
      display: flex;
      width: 100%;
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid #ccc;
    }
    .soukscore-scale .grade-item {
      flex: 1 1 0;
      text-align: center;
      padding: 8px 4px;
      border-right: 1px solid #ccc;
      font-weight: 400;
    }
    .soukscore-scale .grade-item:last-child { border-right: none; }
    .soukscore-scale .grade-item.is-selected,
    .soukscore-scale .grade-item[data-selected="true"] {
      font-weight: 700;
      outline: 2px solid #111;
      outline-offset: -2px;
      background: #f3f3f3;
    }
    .soukscore-missing { margin: 8px 0 0; }
  </style>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 7: SoukScore Risk Rating Scale</h1>
  <p>Horizontal SoukScore scale. Selected grade from frozen Note invoice snapshot only.</p>
  ${buildProspectusSoukscoreRatingScaleSectionHtml(data)}
</body>
</html>`;
}
