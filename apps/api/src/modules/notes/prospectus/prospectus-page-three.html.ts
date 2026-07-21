/**
 * SECTION: Full Prospectus Page 3 HTML assembly
 * WHY: Six visible content stages matching Canva/Data-First map; trends only in Stage 5 column
 */

import { escapeHtml } from "./prospectus-html";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusPageThreeCoverageEfficiencyRowKey } from "./prospectus-page-three-coverage-efficiency.types";
import { PROSPECTUS_PAGE_THREE_METADATA_LABELS } from "./prospectus-page-three-metadata.types";
import type { ProspectusPageThree } from "./prospectus-page-three.types";
import {
  PROSPECTUS_PAGE_THREE_HEIGHT_MM,
  PROSPECTUS_PAGE_THREE_WIDTH_MM,
} from "./prospectus-page-three.types";

/** Visible Stage 1 — page title and subtitle only. */
function renderPageTitle(page: ProspectusPageThree): string {
  const { metadata } = page;
  return `<section data-stage="1" data-content-stage="page-title">
  <h2>${escapeHtml(metadata.pageTitle)}</h2>
  <p>${escapeHtml(metadata.pageSubtitle)}</p>
</section>`;
}

/** Visible Stage 2 — five-item metadata strip (issuer identity omitted entirely). */
function renderMetadataStrip(page: ProspectusPageThree): string {
  const { metadata } = page;
  const labels = PROSPECTUS_PAGE_THREE_METADATA_LABELS;
  const items: Array<{ label: string; value: string }> = [
    { label: labels.sector, value: metadata.metadata.sector },
    { label: labels.riskRating, value: metadata.metadata.riskRating },
    { label: labels.paymaster, value: metadata.metadata.paymaster },
    { label: labels.paymasterGrading, value: metadata.metadata.paymasterGrading },
    { label: labels.confidenceGrading, value: metadata.metadata.confidenceGrading },
  ];
  const cells = items
    .map(
      (item) =>
        `<div class="meta-strip-item">
  <div class="meta-strip-label">${escapeHtml(item.label)}</div>
  <div class="meta-strip-value">${escapeHtml(item.value)}</div>
</div>`
    )
    .join("\n");
  return `<section data-stage="2" data-content-stage="metadata-strip">
  <div class="meta-strip">
${cells}
  </div>
</section>`;
}

/** Stages 3–4 metric tables — year columns only (no Trend column). */
function renderMetricTable(input: {
  stage: string;
  contentStage: string;
  sectionHeading: string;
  years: Array<{ yearLabel: string; financialYearEndLabel: string }>;
  rows: Array<{ label: string; values: string[] }>;
}): string {
  const yearHeaders =
    input.years.length === 0
      ? `<th>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</th>`
      : input.years
          .map(
            (year) =>
              `<th>${escapeHtml(year.yearLabel)}<br /><span>${escapeHtml(
                year.financialYearEndLabel
              )}</span></th>`
          )
          .join("");

  const bodyRows =
    input.years.length === 0
      ? input.rows
          .map(
            (row) =>
              `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(
                PROSPECTUS_DATA_NOT_AVAILABLE
              )}</td></tr>`
          )
          .join("\n")
      : input.rows
          .map((row) => {
            const cells = row.values
              .map((value) => `<td>${escapeHtml(value)}</td>`)
              .join("");
            return `<tr><th scope="row">${escapeHtml(row.label)}</th>${cells}</tr>`;
          })
          .join("\n");

  return `<section data-stage="${escapeHtml(input.stage)}" data-content-stage="${escapeHtml(
    input.contentStage
  )}">
  <h2>${escapeHtml(input.sectionHeading)}</h2>
  <table class="fin-table" border="1" cellpadding="4" cellspacing="0">
    <thead>
      <tr>
        <th>Metric</th>
        ${yearHeaders}
      </tr>
    </thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</section>`;
}

/**
 * Visible Stage 5 — coverage/efficiency rows + Trend (3-Yr) column.
 * Uses only the ten Stage 5 metric keys; does not render the full 26-item trend model.
 */
function renderCoverageEfficiencyWithTrends(page: ProspectusPageThree): string {
  const coverage = page.coverageEfficiency;
  const trendByKey = new Map(
    page.trends.trends.map((item) => [item.metricKey, item.trend] as const)
  );

  const yearHeaders =
    coverage.years.length === 0
      ? `<th>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</th>`
      : coverage.years
          .map(
            (year) =>
              `<th>${escapeHtml(year.yearLabel)}<br /><span>${escapeHtml(
                year.financialYearEndLabel
              )}</span></th>`
          )
          .join("");

  const bodyRows =
    coverage.years.length === 0
      ? coverage.rows
          .map((row) => {
            const trend =
              trendByKey.get(row.key as ProspectusPageThreeCoverageEfficiencyRowKey) ??
              PROSPECTUS_DATA_NOT_AVAILABLE;
            return `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(
              PROSPECTUS_DATA_NOT_AVAILABLE
            )}</td><td class="trend-cell">${escapeHtml(trend)}</td></tr>`;
          })
          .join("\n")
      : coverage.rows
          .map((row) => {
            const cells = row.values
              .map((value) => `<td>${escapeHtml(value)}</td>`)
              .join("");
            const trend =
              trendByKey.get(row.key as ProspectusPageThreeCoverageEfficiencyRowKey) ??
              PROSPECTUS_DATA_NOT_AVAILABLE;
            return `<tr><th scope="row">${escapeHtml(
              row.label
            )}</th>${cells}<td class="trend-cell">${escapeHtml(trend)}</td></tr>`;
          })
          .join("\n");

  return `<section data-stage="5" data-content-stage="coverage-efficiency">
  <h2>${escapeHtml(coverage.sectionHeading)}</h2>
  <table class="fin-table" border="1" cellpadding="4" cellspacing="0">
    <thead>
      <tr>
        <th>Metric</th>
        ${yearHeaders}
        <th>Trend (3-Yr)</th>
      </tr>
    </thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</section>`;
}

/** Visible Stage 6 — investor takeaways. Ends Page 3. */
function renderTakeaways(page: ProspectusPageThree): string {
  const { investorTakeaways } = page;
  const omitted = new Set(investorTakeaways.omittedKeys);
  const bodyRows = investorTakeaways.items
    .filter((item) => !omitted.has(item.key))
    .map(
      (item) =>
        `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${escapeHtml(
          item.takeaway
        )}</td></tr>`
    )
    .join("\n");

  return `<section data-stage="6" data-content-stage="investor-takeaways">
  <h2>${escapeHtml(investorTakeaways.sectionHeading)}</h2>
  <table class="fin-table" border="1" cellpadding="4" cellspacing="0">
    <thead>
      <tr>
        <th>Topic</th>
        <th>Takeaway</th>
      </tr>
    </thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</section>`;
}

export function buildProspectusPageThreeHtml(page: ProspectusPageThree): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 3 — Detailed Financial Comparison</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; }
    .page {
      width: ${PROSPECTUS_PAGE_THREE_WIDTH_MM}mm;
      min-height: ${PROSPECTUS_PAGE_THREE_HEIGHT_MM}mm;
      height: ${PROSPECTUS_PAGE_THREE_HEIGHT_MM}mm;
      box-sizing: border-box;
      padding: 10mm;
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow: hidden;
    }
    h2 { font-size: 12px; margin: 4px 0 2px; }
    p { margin: 2px 0; }
    .prospectus-logo { display: block; max-height: 32px; }
    .brand-name { font-size: 14px; font-weight: 700; margin: 2px 0; }
    .meta-strip {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
      width: 100%;
    }
    .meta-strip-item { min-width: 0; }
    .meta-strip-label { color: #555; font-size: 8px; margin-bottom: 1px; }
    .meta-strip-value { font-weight: 650; font-size: 9.5px; word-break: break-word; }
    .fin-table { width: 100%; border-collapse: collapse; font-size: 9px; }
    .fin-table th, .fin-table td { text-align: left; vertical-align: top; }
  </style>
</head>
<body>
  <div class="page" data-page="prospectus-page-three">
${buildProspectusHeaderHtml(page.header)}
${renderPageTitle(page)}
${renderMetadataStrip(page)}
${renderMetricTable({
  stage: "3",
  contentStage: "income-statement",
  sectionHeading: page.incomeStatement.sectionHeading,
  years: page.incomeStatement.years,
  rows: page.incomeStatement.rows,
})}
${renderMetricTable({
  stage: "4",
  contentStage: "balance-sheet-liquidity",
  sectionHeading: page.balanceSheet.sectionHeading,
  years: page.balanceSheet.years,
  rows: page.balanceSheet.rows,
})}
${renderCoverageEfficiencyWithTrends(page)}
${renderTakeaways(page)}
  </div>
</body>
</html>`;
}
