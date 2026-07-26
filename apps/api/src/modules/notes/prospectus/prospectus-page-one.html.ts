/**
 * SECTION: Full Prospectus Page 1 HTML — A4 reference layout
 * WHY: Match uploaded HTML/CSS; use typed Stage 1–8 view-models only
 */

import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { buildProspectusFooterHtml } from "./prospectus-footer.html";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { buildProspectusHeader } from "./prospectus-header";
import { escapeHtml } from "./prospectus-html";
import { renderProspectusHeroicon } from "./prospectus-icons";
import { buildProspectusRiskShieldHtml } from "./prospectus-risk-shield";
import { PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS } from "./prospectus-historical-note-table.types";
import type { ProspectusPageOne } from "./prospectus-page-one.types";
import {
  PROSPECTUS_PAGE_ONE_HEIGHT_MM,
  PROSPECTUS_PAGE_ONE_WIDTH_MM,
} from "./prospectus-page-one.types";

function renderHistoricalTable(page: ProspectusPageOne): string {
  const table = page.historicalNoteTable;
  const header = PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS.map(
    (label) => `<th>${escapeHtml(label)}</th>`
  ).join("");

  if (table.rows.length === 0) {
    return `<div class="table-wrap"><table>
  <thead><tr>${header}</tr></thead>
  <tbody>
    <tr><td colspan="7">${escapeHtml(
      table.emptyStateMessage ?? "No notes are available yet."
    )}</td></tr>
  </tbody>
</table></div>`;
  }

  const body = table.rows
    .map(
      (row) => `<tr>
  <td>${escapeHtml(row.noteId)}</td>
  <td>${escapeHtml(row.financingType)}</td>
  <td>${escapeHtml(row.amountRm)}</td>
  <td>${escapeHtml(row.tenure)}</td>
  <td>${escapeHtml(row.profitRate)}</td>
  <td>${escapeHtml(row.status)}</td>
  <td>${escapeHtml(row.repaymentDate)}</td>
</tr>`
    )
    .join("\n");

  return `<div class="table-wrap"><table>
  <thead><tr>${header}</tr></thead>
  <tbody>
${body}
  </tbody>
</table></div>`;
}

function summaryRow(label: string, value: string, stage?: string): string {
  const stageAttr = stage ? ` data-stage="${stage}"` : "";
  return `<div${stageAttr}><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function highlightItem(title: string, explanation: string, stage: string): string {
  return `<div class="tick-item" data-stage="${stage}">${renderProspectusHeroicon(
    "highlight-check",
    { className: "icon tick-icon" }
  )}<p><b>${escapeHtml(title)}</b>${escapeHtml(explanation)}</p></div>`;
}

/**
 * Assembles Stage 1–8 Canva-facing sections in approved order using the A4 reference layout.
 */
export function buildProspectusPageOneHtml(page: ProspectusPageOne): string {
  const s1 = page.noteIdentity;
  const s2 = page.datesPaymaster;
  const s3 = page.riskAssessment.canva;
  const s4a = page.mainFinancialTerms;
  const s4b = page.timingPurpose;
  const s4c = page.paymentBasisShariah;
  const s5a = page.paymasterHighlight;
  const s5b = page.issuerFundamentalsHighlight;
  const s5c = page.returnHighlight;
  const s5d = page.shariahHighlight;
  const s6 = page.atAGlance;
  const s7 = page.issuerTrackRecord;
  const header = buildProspectusHeader();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1</title>
  <style>
${PROSPECTUS_DOCUMENT_CSS}
.page.prospectus-page-one{
  width:${PROSPECTUS_PAGE_ONE_WIDTH_MM}mm;
  height:${PROSPECTUS_PAGE_ONE_HEIGHT_MM}mm;
  min-width:${PROSPECTUS_PAGE_ONE_WIDTH_MM}mm;
  min-height:${PROSPECTUS_PAGE_ONE_HEIGHT_MM}mm;
}
  </style>
</head>
<body>
  <main class="document">
  <section class="page prospectus-page-one" data-page="prospectus-page-one">
    ${buildProspectusHeaderHtml(header)}

    <div class="hero-grid">
      <div class="hero-copy" data-stage="1">
        <div class="eyebrow">${escapeHtml(s1.investmentNoteLabel)}</div>
        <h1>${escapeHtml(s1.noteReference)}</h1>
        <div class="product-pill">${escapeHtml(s1.financingType)}</div>
        <p>${escapeHtml(s1.description)}</p>
      </div>
      <div class="key-dates" data-stage="2">
        <div class="meta-row">${renderProspectusHeroicon("listing-date", {
          className: "icon",
        })}<div><b>Listing Date</b><span>${escapeHtml(s2.listingDate)}</span></div></div>
        <div class="meta-row">${renderProspectusHeroicon("closing-date", {
          className: "icon",
        })}<div><b>Closing Date</b><span>${escapeHtml(s2.closingDate)}</span></div></div>
        <div class="meta-row">${renderProspectusHeroicon("maturity-date", {
          className: "icon",
        })}<div><b>Maturity Date</b><span>${escapeHtml(
          s2.maturityDateWithTenure
        )}</span></div></div>
        <div class="meta-row">${renderProspectusHeroicon("paymaster", {
          className: "icon",
        })}<div><b>Paymaster</b><span>${escapeHtml(s2.paymasterDisplay)}</span></div></div>
      </div>
      <div class="risk-panel" data-stage="3">
        <b>Risk Rating</b>
        ${buildProspectusRiskShieldHtml({
          grade: s3.riskGrade,
          color: s3.riskGradeColor,
          textColor: s3.riskGradeTextColor,
        })}
        <strong>${escapeHtml(s3.riskLabel)}</strong>
        <p class="prospectus-risk-description">${escapeHtml(s3.riskExplanation)}</p>
        <a class="scale-link" href="#risk-scale">${escapeHtml(s3.ratingScaleReference)}</a>
      </div>
    </div>

    <section class="card split-card connected-card-top">
      <div>
        <h2>Investment Summary</h2>
        <dl class="summary-list">
          ${summaryRow("Financing Amount", s4a.financingAmount, "4a")}
          ${summaryRow("Minimum Investment", s4a.minimumInvestment)}
          ${summaryRow("Profit rate (p.a.)", s4a.profitRate)}
          ${summaryRow("Expected Return (p.a.)", s4a.expectedReturnForInvestmentPeriod)}
          ${summaryRow("Tenure", s4b.tenure, "4b")}
          ${summaryRow("Maturity Date", s4b.maturityDate)}
          ${summaryRow("Purpose of Financing", s4b.purposeOfFinancing)}
          ${summaryRow("Payment Basis", s4c.paymentBasis, "4c")}
          ${summaryRow("Shariah Principle", s4c.shariahPrinciple)}
        </dl>
      </div>
      <div class="highlights">
        <h2>Key Investor Highlights</h2>
        ${highlightItem(s5a.highlightTitle, s5a.highlightExplanation, "5a")}
        ${highlightItem(s5b.highlightTitle, s5b.highlightExplanation, "5b")}
        ${highlightItem(s5c.highlightTitle, s5c.highlightExplanation, "5c")}
        ${highlightItem(s5d.highlightTitle, s5d.highlightExplanation, "5d")}
      </div>
    </section>

    <section class="strip connected-card-middle" data-stage="6">
      <h2>At a Glance</h2>
      <div class="stats five">
        <div class="stat">${renderProspectusHeroicon("financing", {
          className: "icon",
        })}<small>Financing Amount</small><b>${escapeHtml(s6.financingAmount)}</b></div>
        <div class="stat">${renderProspectusHeroicon("profit-rate", {
          className: "icon",
        })}<small>Profit Rate for Investors</small><b>${escapeHtml(s6.profitRate)}</b></div>
        <div class="stat">${renderProspectusHeroicon("expected-return", {
          className: "icon",
        })}<small>Expected Return (p.a.)</small><b>${escapeHtml(s6.expectedReturn)}</b></div>
        <div class="stat">${renderProspectusHeroicon("tenure", {
          className: "icon",
        })}<small>Tenure</small><b>${escapeHtml(s6.tenure)}</b></div>
        <div class="stat">${renderProspectusHeroicon("minimum-investment", {
          className: "icon",
        })}<small>Minimum Investment</small><b>${escapeHtml(s6.minimumInvestment)}</b></div>
      </div>
    </section>

    <section class="track connected-card-bottom">
      <div data-stage="7">
        <h2>${escapeHtml(s7.sectionHeading)}</h2>
        <div class="stats four">
          <div class="stat">${renderProspectusHeroicon("notes-funded", {
            className: "icon",
          })}<small>Total Notes Funded — All Time</small><b>${escapeHtml(
            s7.totalNotesFunded
          )}</b></div>
          <div class="stat">${renderProspectusHeroicon("amount-funded", {
            className: "icon",
          })}<small>Total Amount Funded — All Time</small><b>${escapeHtml(
            s7.totalAmountFunded
          )}</b></div>
          <div class="stat">${renderProspectusHeroicon("repayment", {
            className: "icon",
          })}<small>Successful Repayment — All Time</small><b>${escapeHtml(
            s7.successfulRepayment
          )}</b></div>
          <div class="stat">${renderProspectusHeroicon("on-time-payment", {
            className: "icon",
          })}<small>${escapeHtml(s7.onTimePaymentRateLabel)}</small><b>${escapeHtml(
            s7.onTimePaymentRate
          )}</b></div>
        </div>
      </div>
      <div data-stage="8">
        ${renderHistoricalTable(page)}
        <em>Past performance is not indicative of future performance.</em>
      </div>
    </section>

    ${buildProspectusFooterHtml()}
  </section>
  </main>
</body>
</html>`;
}
