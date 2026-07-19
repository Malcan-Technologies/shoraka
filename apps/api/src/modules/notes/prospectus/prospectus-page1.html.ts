/**
 * SECTION: Prospectus page-1 HTML/CSS template
 * WHY: Plain TypeScript HTML string for Playwright A4 PDF; no React in API
 */

import type { ProspectusPage1Data } from "./prospectus.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function iconPlaceholder(kind: string): string {
  return `<span class="icon icon-${escapeHtml(kind)}" aria-hidden="true"></span>`;
}

function renderMetaItems(data: ProspectusPage1Data): string {
  return data.metaItems
    .map(
      (item) => `
      <div class="meta-item">
        ${iconPlaceholder("meta")}
        <div>
          <div class="meta-label">${escapeHtml(item.label)}</div>
          <div class="meta-value">${escapeHtml(item.value)}</div>
        </div>
      </div>`
    )
    .join("");
}

function renderSummaryRows(data: ProspectusPage1Data): string {
  return data.investmentSummary
    .map(
      (row, index) => `
      <tr class="${index % 2 === 0 ? "row-even" : "row-odd"}">
        <td>${escapeHtml(row.label)}</td>
        <td>${escapeHtml(row.value)}</td>
      </tr>`
    )
    .join("");
}

function renderHighlights(data: ProspectusPage1Data): string {
  return data.keyHighlights
    .map(
      (item) => `
      <li class="highlight-item">
        ${iconPlaceholder("check")}
        <div>
          <div class="highlight-title">${escapeHtml(item.title)}</div>
          <div class="highlight-desc">${escapeHtml(item.description)}</div>
        </div>
      </li>`
    )
    .join("");
}

function renderGlance(data: ProspectusPage1Data): string {
  return data.atAGlance
    .map(
      (item) => `
      <div class="glance-item">
        ${iconPlaceholder("glance")}
        <div class="glance-label">${escapeHtml(item.label)}</div>
        <div class="glance-value">${escapeHtml(item.value)}</div>
      </div>`
    )
    .join("");
}

function renderTrackMetrics(data: ProspectusPage1Data): string {
  return data.trackRecordMetrics
    .map(
      (item) => `
      <div class="track-metric">
        ${iconPlaceholder("track")}
        <div>
          <div class="track-metric-label">${escapeHtml(item.label)}</div>
          <div class="track-metric-value">${escapeHtml(item.value)}</div>
        </div>
      </div>`
    )
    .join("");
}

function renderHistoricalRows(data: ProspectusPage1Data): string {
  return data.historicalNotes
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.noteId)}</td>
        <td>${escapeHtml(row.financingType)}</td>
        <td class="num">${escapeHtml(row.amountRm)}</td>
        <td>${escapeHtml(row.tenure)}</td>
        <td>${escapeHtml(row.profitRatePa)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td><span class="date-pill">${escapeHtml(row.repaymentDate)}</span></td>
      </tr>`
    )
    .join("");
}

function pageStyles(): string {
  return `
    :root {
      --brand: #8A0304;
      --brand-accent: #CE2922;
      --earth: #6F4924;
      --sand: #BAA38B;
      --text: #1f2937;
      --muted: #6b7280;
      --line: #e5e7eb;
      --panel: #f3f4f6;
      --ok: #16a34a;
      --ok-soft: #dcfce7;
    }

    * { box-sizing: border-box; }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      color: var(--text);
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5px;
      line-height: 1.35;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      height: 297mm;
      padding: 12mm 12mm 10mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 10px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-mark {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 50% 35%, #fff 0 18%, transparent 19%),
        conic-gradient(from 20deg, var(--brand), var(--brand-accent), var(--brand));
      flex-shrink: 0;
    }

    .brand-name {
      font-size: 18px;
      font-weight: 750;
      color: var(--brand);
      letter-spacing: 0.2px;
    }

    .brand-tagline {
      color: var(--muted);
      font-size: 9px;
      margin-top: 1px;
    }

    .compliance {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid #f0d0d0;
      background: #fff7f7;
      color: var(--brand);
      border-radius: 999px;
      padding: 5px 10px;
      font-weight: 650;
      font-size: 9px;
    }

    .hero {
      display: grid;
      grid-template-columns: 1.35fr 1.1fr 0.95fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    .eyebrow {
      color: var(--brand);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.08em;
    }

    .note-ref {
      font-size: 24px;
      font-weight: 750;
      color: var(--text);
      margin: 4px 0 8px;
      letter-spacing: 0.01em;
    }

    .financing-pill {
      display: inline-block;
      background: var(--brand);
      color: #fff;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.02em;
      margin-bottom: 6px;
    }

    .financing-blurb {
      color: var(--muted);
      max-width: 230px;
    }

    .meta-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 14px;
    }

    .meta-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .meta-label {
      color: var(--muted);
      font-size: 8.5px;
    }

    .meta-value {
      font-weight: 650;
      font-size: 10px;
    }

    .risk-panel {
      background: var(--panel);
      border-radius: 10px;
      padding: 12px 12px 10px;
      text-align: center;
    }

    .risk-title {
      font-weight: 750;
      color: var(--text);
      margin-bottom: 8px;
    }

    .risk-shield {
      width: 54px;
      height: 62px;
      margin: 0 auto 6px;
      background: var(--ok);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 800;
      clip-path: polygon(50% 0, 100% 12%, 92% 78%, 50% 100%, 8% 78%, 0 12%);
    }

    .risk-level {
      color: var(--ok);
      font-weight: 750;
      margin-bottom: 4px;
    }

    .risk-desc {
      color: var(--muted);
      font-size: 8.5px;
      margin-bottom: 8px;
    }

    .risk-link {
      color: var(--brand);
      font-weight: 650;
      font-size: 8.5px;
    }

    .mid {
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      gap: 14px;
      margin-bottom: 12px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--brand);
      font-weight: 750;
      letter-spacing: 0.04em;
      font-size: 10.5px;
      margin-bottom: 8px;
    }

    .section-title::before {
      content: "";
      width: 3px;
      height: 12px;
      background: var(--brand);
      border-radius: 2px;
    }

    .summary-table {
      width: 100%;
      border-collapse: collapse;
    }

    .summary-table td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }

    .summary-table td:first-child {
      color: var(--muted);
      width: 48%;
    }

    .summary-table td:last-child {
      font-weight: 650;
      text-align: right;
    }

    .summary-table tr.row-odd td {
      background: #fafafa;
    }

    .highlights {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .highlight-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .highlight-title {
      font-weight: 700;
      margin-bottom: 2px;
    }

    .highlight-desc {
      color: var(--muted);
      font-size: 8.8px;
    }

    .glance {
      margin-bottom: 12px;
    }

    .glance-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 10px 0;
    }

    .glance-item {
      flex: 1;
      text-align: center;
      min-width: 0;
    }

    .glance-label {
      color: var(--muted);
      font-size: 8px;
      margin: 4px 0 2px;
    }

    .glance-value {
      font-weight: 750;
      font-size: 11px;
    }

    .track {
      margin-bottom: 8px;
    }

    .track-metrics {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .track-metric {
      display: flex;
      align-items: center;
      gap: 7px;
      flex: 1;
    }

    .track-metric-label {
      color: var(--muted);
      font-size: 8px;
    }

    .track-metric-value {
      font-weight: 750;
      font-size: 12px;
    }

    .history-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
    }

    .history-table th {
      background: var(--brand);
      color: #fff;
      text-align: left;
      padding: 7px 6px;
      font-weight: 650;
    }

    .history-table th:first-child {
      border-radius: 6px 0 0 0;
    }

    .history-table th:last-child {
      border-radius: 0 6px 0 0;
    }

    .history-table td {
      padding: 7px 6px;
      border-bottom: 1px solid var(--line);
      vertical-align: middle;
    }

    .history-table td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .date-pill {
      display: inline-block;
      background: #f3f4f6;
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--muted);
      font-weight: 600;
    }

    .track-disclaimer {
      margin-top: 6px;
      color: var(--muted);
      font-style: italic;
      font-size: 8px;
    }

    .icon {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      flex-shrink: 0;
      background: var(--brand);
      position: relative;
    }

    .icon-check {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--ok-soft);
      border: 1.5px solid var(--ok);
    }

    .icon-check::after {
      content: "";
      position: absolute;
      left: 4px;
      top: 2px;
      width: 5px;
      height: 8px;
      border: solid var(--ok);
      border-width: 0 1.8px 1.8px 0;
      transform: rotate(45deg);
    }

    .icon-meta,
    .icon-glance,
    .icon-track,
    .icon-compliance {
      background: color-mix(in srgb, var(--brand) 12%, white);
      border: 1px solid color-mix(in srgb, var(--brand) 35%, white);
    }

    .icon-meta::after,
    .icon-glance::after,
    .icon-track::after,
    .icon-compliance::after {
      content: "";
      position: absolute;
      inset: 4px;
      border-radius: 2px;
      background: var(--brand);
      opacity: 0.85;
    }

    .icon-compliance {
      width: 14px;
      height: 14px;
    }
  `;
}

export function buildProspectusPage1Html(data: ProspectusPage1Data): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.brandName)} Prospectus — ${escapeHtml(data.noteReference)}</title>
  <style>${pageStyles()}</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"></div>
        <div>
          <div class="brand-name">${escapeHtml(data.brandName)}</div>
          <div class="brand-tagline">${escapeHtml(data.tagline)}</div>
        </div>
      </div>
      <div class="compliance">
        ${iconPlaceholder("compliance")}
        <span>${escapeHtml(data.complianceBadge)}</span>
      </div>
    </header>

    <section class="hero">
      <div>
        <div class="eyebrow">${escapeHtml(data.documentTitle)}</div>
        <div class="note-ref">${escapeHtml(data.noteReference)}</div>
        <div class="financing-pill">${escapeHtml(data.financingTypeLabel)}</div>
        <div class="financing-blurb">${escapeHtml(data.financingTypeBlurb)}</div>
      </div>
      <div class="meta-list">
        ${renderMetaItems(data)}
      </div>
      <aside class="risk-panel">
        <div class="risk-title">Risk Rating</div>
        <div class="risk-shield">${escapeHtml(data.riskRating.grade)}</div>
        <div class="risk-level">${escapeHtml(data.riskRating.levelLabel)}</div>
        <div class="risk-desc">${escapeHtml(data.riskRating.description)}</div>
        <div class="risk-link">${escapeHtml(data.riskRating.scaleLinkLabel)} →</div>
      </aside>
    </section>

    <section class="mid">
      <div>
        <div class="section-title">INVESTMENT SUMMARY</div>
        <table class="summary-table">
          <tbody>
            ${renderSummaryRows(data)}
          </tbody>
        </table>
      </div>
      <div>
        <div class="section-title">KEY INVESTOR HIGHLIGHTS</div>
        <ul class="highlights">
          ${renderHighlights(data)}
        </ul>
      </div>
    </section>

    <section class="glance">
      <div class="section-title">AT A GLANCE</div>
      <div class="glance-row">
        ${renderGlance(data)}
      </div>
    </section>

    <section class="track">
      <div class="section-title">${escapeHtml(data.trackRecordHeading)}</div>
      <div class="track-metrics">
        ${renderTrackMetrics(data)}
      </div>
      <table class="history-table">
        <thead>
          <tr>
            <th>Note ID</th>
            <th>Financing Type</th>
            <th>Amount (RM)</th>
            <th>Tenure</th>
            <th>Profit Rate (p.a.)</th>
            <th>Status</th>
            <th>Repayment Date</th>
          </tr>
        </thead>
        <tbody>
          ${renderHistoricalRows(data)}
        </tbody>
      </table>
      <div class="track-disclaimer">${escapeHtml(data.trackRecordDisclaimer)}</div>
    </section>
  </main>
</body>
</html>`;
}
