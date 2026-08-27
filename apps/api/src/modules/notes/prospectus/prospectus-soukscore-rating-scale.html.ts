/**
 * SECTION: Plain HTML for Page 2 Risk Rating Scale
 * WHY: Full A–F reference scale; white grade letters; no selected-grade highlight
 */

import { CASHSCOUK_RISK_GRADE_LETTER_COLOR, MARC_SME_BANDS } from "@cashsouk/types";
import { escapeHtml, escapeHtmlAttribute } from "./prospectus-html";
import { PROSPECTUS_RISK_SCALE_NOTE } from "./prospectus-static-copy";
import type { ProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale.types";

export function buildProspectusMarcRatingScaleSectionHtml(): string {
  const gradeCells = MARC_SME_BANDS.map((band) => {
    return `    <li class="grade-item" data-grade="${escapeHtml(band.rangeLabel)}">
      <span class="grade marc ${escapeHtmlAttribute(band.key)}" style="background:${escapeHtmlAttribute(
        band.color
      )};color:${escapeHtmlAttribute(CASHSCOUK_RISK_GRADE_LETTER_COLOR)}">${escapeHtml(
        band.rangeLabel
      )}</span>
      <strong class="grade-label">${escapeHtml(band.label)}</strong>
      <span class="grade-desc">${escapeHtml(band.explanation)}</span>
    </li>`;
  }).join("\n");

  return `<section data-stage="7" data-marc-scale-version="sme-1-10">
  <h2>Risk Rating Scale</h2>
  <ol class="soukscore-scale" aria-label="MARC SME Risk Rating Scale">
${gradeCells}
  </ol>
  <p class="risk-scale-note">${escapeHtml(PROSPECTUS_RISK_SCALE_NOTE)}</p>
</section>`;
}

/** Shared section markup used by stage preview and full Page 2 assembly. */
export function buildProspectusSoukscoreRatingScaleSectionHtml(
  data: ProspectusSoukscoreRatingScale
): string {
  const gradeCells = data.grades
    .map((item) => {
      return `    <li class="grade-item" data-grade="${escapeHtml(item.grade)}">
      <span class="grade" style="background:${escapeHtmlAttribute(
        item.color
      )};color:${escapeHtmlAttribute(CASHSCOUK_RISK_GRADE_LETTER_COLOR)}">${escapeHtml(
        item.grade
      )}</span>
      <strong class="grade-label">${escapeHtml(item.label)}</strong>
      <span class="grade-desc">${escapeHtml(item.explanation)}</span>
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
  </ol>
  <p class="risk-scale-note">${escapeHtml(PROSPECTUS_RISK_SCALE_NOTE)}</p>${missing}
</section>`;
}

export function buildProspectusSoukscoreRatingScaleHtml(
  data: ProspectusSoukscoreRatingScale
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — Risk Rating Scale</title>
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
    .soukscore-scale .grade {
      display: inline-block;
      min-width: 28px;
      padding: 4px 6px;
      margin-bottom: 4px;
      font-weight: 800;
      color: #fff;
      background: #f3f3f3;
    }
    .soukscore-scale .grade-label {
      display: block;
      font-size: 9px;
      margin-bottom: 4px;
    }
    .soukscore-scale .grade-desc {
      display: block;
      font-size: 8px;
      line-height: 1.3;
      color: #444;
    }
    .soukscore-missing { margin: 8px 0 0; }
  </style>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 7: Risk Rating Scale</h1>
  <p>Full A–F scale with catalogue labels. Reference scale only — no selected-grade highlight.</p>
  ${buildProspectusSoukscoreRatingScaleSectionHtml(data)}
</body>
</html>`;
}
