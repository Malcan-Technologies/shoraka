/**
 * SECTION: Full Prospectus Page 3 HTML assembly
 * WHY: One A4 document; Stages 1–6 Canva-facing sections; no audit/Prisma IDs/source paths
 */

import { escapeHtml, escapeHtmlAttribute } from "./prospectus-html";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusPageThree } from "./prospectus-page-three.types";
import {
  PROSPECTUS_PAGE_THREE_HEIGHT_MM,
  PROSPECTUS_PAGE_THREE_WIDTH_MM,
} from "./prospectus-page-three.types";
import { PROSPECTUS_PAGE_THREE_METADATA_LABELS } from "./prospectus-page-three-metadata.types";

function renderHeader(page: ProspectusPageThree): string {
  const { header } = page;
  const logoHtml =
    header.logo.kind === "official_asset"
      ? `<img class="prospectus-logo" src="${escapeHtmlAttribute(
          header.logo.previewSrc
        )}" alt="${escapeHtmlAttribute(header.logo.alt)}" height="40" />`
      : `<span class="prospectus-logo-text">${escapeHtml(header.logo.text)}</span>`;

  return `<header class="prospectus-header" data-stage="header">
  ${logoHtml}
  <p class="brand-name">${escapeHtml(header.brandName)}</p>
  <p>Brand Tagline: ${escapeHtml(header.tagline)}</p>
  <p>Shariah Status Badge: ${escapeHtml(header.shariahStatusBadge)}</p>
</header>`;
}

function renderMetadata(page: ProspectusPageThree): string {
  const { metadata } = page;
  const labels = PROSPECTUS_PAGE_THREE_METADATA_LABELS;
  return `<section data-stage="1">
  <h2>${escapeHtml(metadata.pageTitle)}</h2>
  <p>${escapeHtml(metadata.pageSubtitle)}</p>
  <p>
    ${escapeHtml(labels.issuer)}: ${escapeHtml(metadata.metadata.issuer)}<br />
    ${escapeHtml(labels.sector)}: ${escapeHtml(metadata.metadata.sector)}<br />
    ${escapeHtml(labels.riskRating)}: ${escapeHtml(metadata.metadata.riskRating)}<br />
    ${escapeHtml(labels.paymaster)}: ${escapeHtml(metadata.metadata.paymaster)}<br />
    ${escapeHtml(labels.paymasterGrading)}: ${escapeHtml(metadata.metadata.paymasterGrading)}<br />
    ${escapeHtml(labels.confidenceGrading)}: ${escapeHtml(metadata.metadata.confidenceGrading)}
  </p>
</section>`;
}

function renderMetricTable(input: {
  stage: string;
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

  return `<section data-stage="${escapeHtml(input.stage)}">
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

function renderTrends(page: ProspectusPageThree): string {
  const { trends } = page;
  const bodyRows = trends.trends
    .map(
      (item) =>
        `<tr><th scope="row">${escapeHtml(item.metricLabel)}</th><td>${escapeHtml(
          item.trend
        )}</td></tr>`
    )
    .join("\n");

  return `<section data-stage="5">
  <h2>${escapeHtml(trends.sectionHeading)}</h2>
  <table class="fin-table" border="1" cellpadding="4" cellspacing="0">
    <thead>
      <tr>
        <th>Metric</th>
        <th>Trend</th>
      </tr>
    </thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</section>`;
}

function renderTakeaways(page: ProspectusPageThree): string {
  const { investorTakeaways } = page;
  const bodyRows = investorTakeaways.items
    .map(
      (item) =>
        `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${escapeHtml(
          item.takeaway
        )}</td></tr>`
    )
    .join("\n");

  return `<section data-stage="6">
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

function renderFooter(page: ProspectusPageThree): string {
  const { footer } = page;
  return `<footer class="prospectus-footer" data-stage="footer">
  <p>Investment Risk Warning: ${escapeHtml(footer.investmentRiskWarning)}</p>
  <p>Product Terms / Risk Disclosure Statement: ${escapeHtml(
    footer.productTermsRiskDisclosureStatement
  )}</p>
</footer>`;
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
    .fin-table { width: 100%; border-collapse: collapse; font-size: 9px; }
    .fin-table th, .fin-table td { text-align: left; vertical-align: top; }
    .prospectus-footer { margin-top: auto; font-size: 8px; }
  </style>
</head>
<body>
  <div class="page" data-page="prospectus-page-three">
${renderHeader(page)}
${renderMetadata(page)}
${renderMetricTable({
  stage: "2",
  sectionHeading: page.incomeStatement.sectionHeading,
  years: page.incomeStatement.years,
  rows: page.incomeStatement.rows,
})}
${renderMetricTable({
  stage: "3",
  sectionHeading: page.balanceSheet.sectionHeading,
  years: page.balanceSheet.years,
  rows: page.balanceSheet.rows,
})}
${renderMetricTable({
  stage: "4",
  sectionHeading: page.coverageEfficiency.sectionHeading,
  years: page.coverageEfficiency.years,
  rows: page.coverageEfficiency.rows,
})}
${renderTrends(page)}
${renderTakeaways(page)}
${renderFooter(page)}
  </div>
</body>
</html>`;
}
