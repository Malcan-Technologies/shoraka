/**
 * SECTION: Full Prospectus Page 2 HTML — A4 reference layout
 * WHY: Match uploaded HTML/CSS; typed Stage 1–8 view-models; no issuer identity
 */

import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { buildProspectusFooterHtml } from "./prospectus-footer.html";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { escapeHtml } from "./prospectus-html";
import { prospectusIcon } from "./prospectus-icons";
import { buildProspectusInvestmentCtaHtml } from "./prospectus-investment-cta.html";
import { PROSPECTUS_CREDIT_INSIGHTS_DESCRIPTION } from "./prospectus-credit-insights.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusPageTwo } from "./prospectus-page-two.types";
import {
  PROSPECTUS_PAGE_TWO_HEIGHT_MM,
  PROSPECTUS_PAGE_TWO_WIDTH_MM,
} from "./prospectus-page-two.types";
import { buildProspectusSoukscoreRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";

function renderFinancialTable(page: ProspectusPageTwo): string {
  const data = page.financialComparisonMetrics;
  const yearHeaders =
    data.years.length === 0
      ? `<th>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</th>`
      : data.years
          .map(
            (year) =>
              `<th><span class="fy-label">${escapeHtml(
                year.yearLabel
              )}</span><span class="fy-end">${escapeHtml(
                year.financialYearEndLabel
              )}</span></th>`
          )
          .join("");

  const bodyRows =
    data.years.length === 0
      ? data.rows
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(
                PROSPECTUS_DATA_NOT_AVAILABLE
              )}</td></tr>`
          )
          .join("\n")
      : data.rows
          .map((row) => {
            const cells = row.values
              .map((value) => `<td>${escapeHtml(value)}</td>`)
              .join("");
            return `<tr><td>${escapeHtml(row.label)}</td>${cells}</tr>`;
          })
          .join("\n");

  return `<div data-stage="4">
  <h2>${escapeHtml(data.sectionHeading)}</h2>
  <div class="table-wrap"><table class="plain">
    <thead>
      <tr>
        <th>Financial Metric</th>
        ${yearHeaders}
      </tr>
    </thead>
    <tbody>
${bodyRows}
    </tbody>
  </table></div>
  <em class="fin-source">${escapeHtml(data.sourceFooter)}</em>
</div>`;
}

function formatIssuerIndustrySizeLine(industry: string, companySize: string): string {
  const missingIndustry =
    !industry.trim() || industry === PROSPECTUS_DATA_NOT_AVAILABLE;
  const missingSize =
    !companySize.trim() || companySize === PROSPECTUS_DATA_NOT_AVAILABLE;
  if (missingIndustry && missingSize) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return `${missingIndustry ? PROSPECTUS_DATA_NOT_AVAILABLE : industry} | ${
    missingSize ? PROSPECTUS_DATA_NOT_AVAILABLE : companySize
  }`;
}

function ratingRow(label: string, value: string): string {
  const goodClass = /good/i.test(value) ? ' class="good"' : "";
  return `<div><span>${escapeHtml(label)}</span><b${goodClass}>${escapeHtml(value)}</b></div>`;
}

function workItem(icon: string, text: string): string {
  if (!text.trim()) return "";
  return `<p>${icon}${escapeHtml(text)}</p>`;
}

export function buildProspectusPageTwoHtml(page: ProspectusPageTwo): string {
  const s1 = page.issuerProfile;
  const s2 = page.invoicePaymaster;
  const s3 = page.paymasterTrackRecord;
  const s5 = page.creditInsights;
  const s6 = page.invoiceWorkNarrative;

  const workItems = [
    workItem(prospectusIcon.fileText("icon"), s6.workUnderContractStatement),
    workItem(prospectusIcon.badgeCheck("icon"), s6.certificationAcceptanceStatement),
    workItem(prospectusIcon.fileText("icon"), s6.paymasterTrustAccountStatement),
    workItem(prospectusIcon.fileCheck("icon"), s6.deedOfAssignmentStatement),
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2</title>
  <style>
${PROSPECTUS_DOCUMENT_CSS}
.page.prospectus-page-two{
  width:${PROSPECTUS_PAGE_TWO_WIDTH_MM}mm;
  height:${PROSPECTUS_PAGE_TWO_HEIGHT_MM}mm;
  min-width:${PROSPECTUS_PAGE_TWO_WIDTH_MM}mm;
  min-height:${PROSPECTUS_PAGE_TWO_HEIGHT_MM}mm;
}
  </style>
</head>
<body>
  <main class="document">
  <section class="page prospectus-page-two" data-page="prospectus-page-two">
    ${buildProspectusHeaderHtml(page.header)}

    <div class="issuer-grid">
      <section data-stage="1" data-issuer-profile>
        <h2>${escapeHtml(s1.sectionHeading)}</h2>
        <div class="issuer-profile">
          <div class="round-icon">${prospectusIcon.building("icon")}</div>
          <div>
            <b class="issuer-meta-line">${escapeHtml(
              formatIssuerIndustrySizeLine(s1.industry, s1.companySize)
            )}</b>
            <span>${escapeHtml(s1.registeredCountry)}</span>
          </div>
        </div>
        <p>${escapeHtml(s1.businessDescription)}</p>
      </section>
      <section class="invoice-info" data-stage="2">
        <h2>${escapeHtml(s2.sectionHeading)}</h2>
        <dl>
          <div><dt>${prospectusIcon.badgeDollar("icon")}Invoice Amount</dt><dd>${escapeHtml(s2.invoiceAmount)}</dd></div>
          <div><dt>${prospectusIcon.calendarDays("icon")}Invoice Due Date</dt><dd>${escapeHtml(s2.invoiceDueDate)}</dd></div>
          <div><dt>${prospectusIcon.badgeCheck("icon")}Paymaster</dt><dd>${escapeHtml(s2.paymasterName)}</dd></div>
          <div><dt>${prospectusIcon.landmark("icon")}Nature of Paymaster</dt><dd>${escapeHtml(s2.paymasterNature)}</dd></div>
          <div><dt>${prospectusIcon.fileCheck("icon")}Deed of Assignment (DOA)</dt><dd>${escapeHtml(s2.deedOfAssignment)}</dd></div>
          <div><dt>${prospectusIcon.clipboardCheck("icon")}Paymaster Rating</dt><dd>${escapeHtml(s2.paymasterRating)}</dd></div>
          <div><dt>${prospectusIcon.clipboardCheck("icon")}Confidence Grading</dt><dd>${escapeHtml(s2.confidenceGrading)}</dd></div>
        </dl>
      </section>
    </div>

    <section class="card financial-card page-two-financial-card">
      <div class="paymaster-record" data-stage="3">
        <h2>${escapeHtml(s3.sectionHeading)}</h2>
        <dl class="summary-list compact">
          <div><dt>Total Invoices Paid</dt><dd>${escapeHtml(s3.totalInvoicesPaid)}</dd></div>
          <div><dt>Total Amount Paid</dt><dd>${escapeHtml(s3.totalAmountPaid)}</dd></div>
          <div><dt>Successful Repayment</dt><dd>${escapeHtml(s3.successfulRepaymentPercent)}</dd></div>
          <div><dt>On-Time Payment</dt><dd>${escapeHtml(s3.onTimePayment)}</dd></div>
          <div><dt>Average Payment Period</dt><dd>${escapeHtml(s3.averagePaymentPeriod)}</dd></div>
        </dl>
      </div>
      ${renderFinancialTable(page)}
    </section>

    <section class="card split-card lower page-two-insights-card">
      <div data-stage="5">
        <h2>${escapeHtml(s5.sectionHeading)}</h2>
        <div class="ratings">
          ${ratingRow("Credit Score", s5.creditScore)}
          ${ratingRow("Payment Behaviour", s5.paymentBehaviour)}
          ${ratingRow("Credit Utilisation", s5.creditUtilisation)}
          ${ratingRow("Litigation Check", s5.litigationCheck)}
          ${ratingRow("CCRIS Status", s5.ccrisStatus)}
        </div>
        <em class="credit-insights-note">${escapeHtml(
          s5.description || PROSPECTUS_CREDIT_INSIGHTS_DESCRIPTION
        )}</em>
      </div>
      <div class="work-list" data-stage="6">
        <h2>${escapeHtml(s6.sectionHeading)}</h2>
        ${workItems || `<p>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</p>`}
      </div>
    </section>

    <div class="risk-cta page-two-risk-cta" id="risk-scale">
      <section class="card">
        ${buildProspectusSoukscoreRatingScaleSectionHtml(page.soukscoreRatingScale)}
      </section>
      <aside class="cta">
        ${buildProspectusInvestmentCtaHtml(page.investmentCta)}
      </aside>
    </div>

    ${buildProspectusFooterHtml()}
  </section>
  </main>
</body>
</html>`;
}
