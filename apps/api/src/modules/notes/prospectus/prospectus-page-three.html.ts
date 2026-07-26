/**
 * SECTION: Full Prospectus Page 3 HTML — A4 reference layout
 * WHY: Six visible content stages; no issuer identity; shared header/footer
 */

import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { buildProspectusFooterHtml } from "./prospectus-footer.html";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { escapeHtml } from "./prospectus-html";
import { renderProspectusHeroicon } from "./prospectus-icons";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusPageThreeCoverageEfficiencyRowKey } from "./prospectus-page-three-coverage-efficiency.types";
import { PROSPECTUS_PAGE_THREE_METADATA_LABELS } from "./prospectus-page-three-metadata.types";
import type { ProspectusPageThree } from "./prospectus-page-three.types";
import {
  PROSPECTUS_PAGE_THREE_HEIGHT_MM,
  PROSPECTUS_PAGE_THREE_WIDTH_MM,
} from "./prospectus-page-three.types";
import type { ProspectusPageThreeTrendItem } from "./prospectus-page-three-trends.types";

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

type ApprovedTrendDirection = {
  approved: boolean;
  direction: "up" | "down" | "neutral" | null;
};

/**
 * Trend cell: arrows only when an approved direction exists.
 * Today builders set approved:false and direction:null — always —.
 * Do not invent year-over-year formulas here.
 */
function renderTrendCell(item: ProspectusPageThreeTrendItem | undefined): string {
  const trend = item as ApprovedTrendDirection | undefined;
  if (trend?.approved === true && trend.direction === "up") {
    return `<td class="trend-cell up">↑</td>`;
  }
  if (trend?.approved === true && trend.direction === "down") {
    return `<td class="trend-cell down">↓</td>`;
  }
  return `<td class="trend-cell">${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</td>`;
}

function takeawayIcon(key: string): string {
  switch (key) {
    case "revenue_profitability":
      return renderProspectusHeroicon("revenue-profitability", { className: "icon" });
    case "liquidity":
      return renderProspectusHeroicon("liquidity", { className: "icon" });
    case "leverage":
      return renderProspectusHeroicon("leverage", { className: "icon" });
    case "debt_servicing_capacity":
      return renderProspectusHeroicon("debt-servicing", { className: "icon" });
    case "receivables_collection":
      return renderProspectusHeroicon("receivables", { className: "icon" });
    case "overall_financial_profile":
      return renderProspectusHeroicon("overall-profile", { className: "icon" });
    default:
      return renderProspectusHeroicon("work-performed", { className: "icon" });
  }
}

function metaIcon(labelKey: keyof typeof PROSPECTUS_PAGE_THREE_METADATA_LABELS): string {
  switch (labelKey) {
    case "sector":
      return renderProspectusHeroicon("sector", { className: "icon" });
    case "riskRating":
      return renderProspectusHeroicon("risk-rating", { className: "icon" });
    case "paymaster":
      return renderProspectusHeroicon("paymaster", { className: "icon" });
    case "paymasterGrading":
      return renderProspectusHeroicon("rating", { className: "icon" });
    case "confidenceGrading":
      return renderProspectusHeroicon("confidence", { className: "icon" });
    default:
      return renderProspectusHeroicon("listing-date", { className: "icon" });
  }
}

function renderPageTitle(page: ProspectusPageThree): string {
  const { metadata } = page;
  return `<div class="page-title" data-stage="1" data-content-stage="page-title">
  <h1>${escapeHtml(metadata.pageTitle)}</h1>
  <p data-page-subtitle="true">${escapeHtml(metadata.pageSubtitle)}</p>
</div>`;
}

function renderMetadataStrip(page: ProspectusPageThree): string {
  const { metadata } = page;
  const labels = PROSPECTUS_PAGE_THREE_METADATA_LABELS;
  const items: Array<{
    key: keyof typeof PROSPECTUS_PAGE_THREE_METADATA_LABELS;
    label: string;
    value: string;
  }> = [
    { key: "sector", label: labels.sector, value: metadata.metadata.sector },
    { key: "riskRating", label: labels.riskRating, value: metadata.metadata.riskRating },
    { key: "paymaster", label: labels.paymaster, value: metadata.metadata.paymaster },
    {
      key: "paymasterGrading",
      label: labels.paymasterGrading,
      value: metadata.metadata.paymasterGrading,
    },
    {
      key: "confidenceGrading",
      label: labels.confidenceGrading,
      value: metadata.metadata.confidenceGrading,
    },
  ];
  const cells = items
    .map(
      (item) =>
        `<div class="meta-strip-item" data-meta-key="${item.key}">
  ${metaIcon(item.key)}
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
    page.trends.trends.map((item) => [item.metricKey, item] as const)
  );

  const yearHeaders = yearHeaderCells(coverage.years);
  const bodyRows =
    coverage.years.length === 0
      ? coverage.rows
          .map((row) => {
            const trendItem = trendByKey.get(
              row.key as ProspectusPageThreeCoverageEfficiencyRowKey
            );
            return `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(
              PROSPECTUS_DATA_NOT_AVAILABLE
            )}</td>${renderTrendCell(trendItem)}</tr>`;
          })
          .join("\n")
      : coverage.rows
          .map((row) => {
            const cells = row.values
              .map((value) => `<td>${escapeHtml(value)}</td>`)
              .join("");
            const trendItem = trendByKey.get(
              row.key as ProspectusPageThreeCoverageEfficiencyRowKey
            );
            return `<tr><td>${escapeHtml(row.label)}</td>${cells}${renderTrendCell(
              trendItem
            )}</tr>`;
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
            `<p class="takeaway-item" data-takeaway-key="${escapeHtml(
              item.key
            )}">${takeawayIcon(item.key)}<span><b>${escapeHtml(
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
      ${renderIncome(page)}
      ${renderBalance(page)}
      ${renderCoverage(page)}
      ${renderTakeaways(page)}
    </div>
    <em class="source financial-source">${escapeHtml(
      page.financialSource.sourceFooter
    )}</em>
    ${buildProspectusFooterHtml()}
  </section>
  </main>
</body>
</html>`;
}
