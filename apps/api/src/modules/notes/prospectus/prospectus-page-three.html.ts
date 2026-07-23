/**
 * SECTION: Full Prospectus Page 3 HTML — A4 reference layout
 * WHY: Six visible content stages; no issuer identity; shared header/footer
 */

import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { buildProspectusFooterHtml } from "./prospectus-footer.html";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { escapeHtml } from "./prospectus-html";
import { prospectusIcon } from "./prospectus-icons";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusPageThreeCoverageEfficiencyRowKey } from "./prospectus-page-three-coverage-efficiency.types";
import { PROSPECTUS_PAGE_THREE_METADATA_LABELS } from "./prospectus-page-three-metadata.types";
import type { ProspectusPageThree } from "./prospectus-page-three.types";
import {
  PROSPECTUS_PAGE_THREE_HEIGHT_MM,
  PROSPECTUS_PAGE_THREE_WIDTH_MM,
} from "./prospectus-page-three.types";

function yearHeaderCells(
  years: Array<{ yearLabel: string; financialYearEndLabel: string }>
): string {
  if (years.length === 0) {
    return `<th>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</th>`;
  }
  return years
    .map(
      (year) =>
        `<th><span class="fy-label">${escapeHtml(
          year.yearLabel
        )}</span><span class="fy-end">${escapeHtml(
          year.financialYearEndLabel
        )}</span></th>`
    )
    .join("");
}

function metricBodyRows(
  years: Array<{ yearLabel: string }>,
  rows: Array<{ label: string; values: string[] }>
): string {
  if (years.length === 0) {
    return rows
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(
            PROSPECTUS_DATA_NOT_AVAILABLE
          )}</td></tr>`
      )
      .join("\n");
  }
  return rows
    .map((row) => {
      const cells = row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join("");
      return `<tr><td>${escapeHtml(row.label)}</td>${cells}</tr>`;
    })
    .join("\n");
}

function trendClass(trend: string): string {
  const t = trend.trim().toLowerCase();
  if (t.includes("↑") || t.includes("improv") || t.includes("up") || t === "increasing") {
    return "up";
  }
  if (t.includes("↓") || t.includes("wors") || t.includes("down") || t === "decreasing") {
    return "down";
  }
  return "";
}

function takeawayIcon(key: string): string {
  switch (key) {
    case "revenue_profitability":
      return prospectusIcon.chart("icon");
    case "liquidity":
      return prospectusIcon.droplets("icon");
    case "leverage":
      return prospectusIcon.shieldCheck("icon");
    case "debt_servicing_capacity":
      return prospectusIcon.percent("icon");
    case "receivables_collection":
      return prospectusIcon.calendarDays("icon");
    case "overall_financial_profile":
      return prospectusIcon.target("icon");
    default:
      return prospectusIcon.fileText("icon");
  }
}

function renderPageTitle(page: ProspectusPageThree): string {
  const { metadata } = page;
  const subtitle = metadata.pageSubtitle.trim();
  const subtitleHtml =
    subtitle.length === 0
      ? ""
      : `<p>${escapeHtml(subtitle)}</p>`;
  return `<div class="page-title" data-stage="1" data-content-stage="page-title">
  <h1>${escapeHtml(metadata.pageTitle)}</h1>
  ${subtitleHtml}
</div>`;
}

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
  ${prospectusIcon.calendarDays("icon")}
  <span>
    <span class="meta-strip-label">${escapeHtml(item.label)}</span>
    <span class="meta-strip-value">${escapeHtml(item.value)}</span>
  </span>
</div>`
    )
    .join("\n");
  return `<section class="identity-strip card meta-strip" data-stage="2" data-content-stage="metadata-strip">
${cells}
</section>`;
}

function renderIncome(page: ProspectusPageThree): string {
  const { incomeStatement } = page;
  return `<section class="card report-box" data-stage="3" data-content-stage="income-statement">
  <h2>${escapeHtml(incomeStatement.sectionHeading)}</h2>
  <table>
    <thead><tr><th>Financial Metrics</th>${yearHeaderCells(incomeStatement.years)}</tr></thead>
    <tbody>
${metricBodyRows(incomeStatement.years, incomeStatement.rows)}
    </tbody>
  </table>
</section>`;
}

function renderBalance(page: ProspectusPageThree): string {
  const { balanceSheet } = page;
  return `<section class="card report-box" data-stage="4" data-content-stage="balance-sheet-liquidity">
  <h2>${escapeHtml(balanceSheet.sectionHeading)}</h2>
  <table>
    <thead><tr><th>Financial Metrics</th>${yearHeaderCells(balanceSheet.years)}</tr></thead>
    <tbody>
${metricBodyRows(balanceSheet.years, balanceSheet.rows)}
    </tbody>
  </table>
</section>`;
}

function renderCoverage(page: ProspectusPageThree): string {
  const coverage = page.coverageEfficiency;
  const trendByKey = new Map(
    page.trends.trends.map((item) => [item.metricKey, item.trend] as const)
  );

  const yearHeaders = yearHeaderCells(coverage.years);
  const bodyRows =
    coverage.years.length === 0
      ? coverage.rows
          .map((row) => {
            const trend =
              trendByKey.get(row.key as ProspectusPageThreeCoverageEfficiencyRowKey) ??
              PROSPECTUS_DATA_NOT_AVAILABLE;
            const cls = trendClass(trend);
            return `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(
              PROSPECTUS_DATA_NOT_AVAILABLE
            )}</td><td class="trend-cell${cls ? ` ${cls}` : ""}">${escapeHtml(trend)}</td></tr>`;
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
            const cls = trendClass(trend);
            return `<tr><td>${escapeHtml(row.label)}</td>${cells}<td class="trend-cell${
              cls ? ` ${cls}` : ""
            }">${escapeHtml(trend)}</td></tr>`;
          })
          .join("\n");

  return `<section class="card report-box" data-stage="5" data-content-stage="coverage-efficiency">
  <h2>${escapeHtml(coverage.sectionHeading)}</h2>
  <table class="coverage-table">
    <thead>
      <tr>
        <th>Financial Metrics</th>
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

function renderTakeaways(page: ProspectusPageThree): string {
  const { investorTakeaways } = page;
  const omitted = new Set(investorTakeaways.omittedKeys);
  const visible = investorTakeaways.items.filter((item) => !omitted.has(item.key));
  const hasContent = visible.some(
    (item) =>
      item.takeaway.trim().length > 0 &&
      item.takeaway !== PROSPECTUS_DATA_NOT_AVAILABLE
  );

  const body = hasContent
    ? visible
        .filter(
          (item) =>
            item.takeaway.trim().length > 0 &&
            item.takeaway !== PROSPECTUS_DATA_NOT_AVAILABLE
        )
        .map(
          (item) =>
            `<p class="takeaway-item">${takeawayIcon(item.key)}<span><b>${escapeHtml(
              item.label
            )}</b> ${escapeHtml(item.takeaway)}</span></p>`
        )
        .join("\n")
    : `<p class="takeaways-empty">${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</p>`;

  return `<section class="card report-box takeaways" data-stage="6" data-content-stage="investor-takeaways">
  <h2>${escapeHtml(investorTakeaways.sectionHeading)}</h2>
  ${body}
</section>`;
}

export function buildProspectusPageThreeHtml(page: ProspectusPageThree): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 3 — Detailed Financial Comparison</title>
  <style>
${PROSPECTUS_DOCUMENT_CSS}
.page.prospectus-page-three{
  width:${PROSPECTUS_PAGE_THREE_WIDTH_MM}mm;
  height:${PROSPECTUS_PAGE_THREE_HEIGHT_MM}mm;
  min-width:${PROSPECTUS_PAGE_THREE_WIDTH_MM}mm;
  min-height:${PROSPECTUS_PAGE_THREE_HEIGHT_MM}mm;
  overflow:hidden;
}
  </style>
</head>
<body>
  <main class="document">
  <section class="page prospectus-page-three" data-page="prospectus-page-three">
    ${buildProspectusHeaderHtml(page.header)}
    ${renderPageTitle(page)}
    ${renderMetadataStrip(page)}
    <div class="comparison-grid">
      <div class="comparison-row comparison-row-top">
        ${renderIncome(page)}
        ${renderBalance(page)}
      </div>
      <div class="comparison-row comparison-row-bottom">
        ${renderCoverage(page)}
        ${renderTakeaways(page)}
      </div>
    </div>
    <div class="page-bottom">
      <em class="source">${escapeHtml(page.financialSource.sourceFooter)}</em>
      ${buildProspectusFooterHtml()}
    </div>
  </section>
  </main>
</body>
</html>`;
}
