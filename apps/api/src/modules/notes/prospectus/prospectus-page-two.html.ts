/**
 * SECTION: Full Prospectus Page 2 HTML — A4 reference layout
 * WHY: Match uploaded HTML/CSS; typed Stage 1–8 view-models; no issuer identity
 */

import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { buildProspectusFooterHtml } from "./prospectus-footer.html";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { escapeHtml } from "./prospectus-html";
import { renderProspectusHeroicon } from "./prospectus-icons";
import { buildProspectusInvestmentCtaHtml } from "./prospectus-investment-cta.html";
import { PROSPECTUS_CREDIT_INSIGHTS_DESCRIPTION } from "./prospectus-credit-insights.types";
import { formatProspectusIndustryAndCompanySize } from "./prospectus-industry-company-size";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusPageTwo } from "./prospectus-page-two.types";
import {
  PROSPECTUS_PAGE_TWO_HEIGHT_MM,
  PROSPECTUS_PAGE_TWO_WIDTH_MM,
} from "./prospectus-page-two.types";
import { buildProspectusMarcRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";

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
    workItem(
      renderProspectusHeroicon("work-performed", { className: "icon" }),
      s6.workUnderContractStatement
    ),
    workItem(
      renderProspectusHeroicon("work-certification", { className: "icon" }),
      s6.certificationAcceptanceStatement
    ),
    workItem(
      renderProspectusHeroicon("work-trust-account", { className: "icon" }),
      s6.paymasterTrustAccountStatement
    ),
    workItem(
      renderProspectusHeroicon("work-assignment", { className: "icon" }),
      s6.deedOfAssignmentStatement
    ),
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

    <div class="issuer-grid page-two-issuer-grid">
      <section data-stage="1" data-issuer-profile>
        <h2>${escapeHtml(s1.sectionHeading)}</h2>
        <div class="issuer-profile">
          <div class="round-icon prospectus-issuer-icon-circle">${renderProspectusHeroicon(
            "issuer",
            { className: "icon prospectus-issuer-icon" }
          )}</div>
          <div>
            <b class="issuer-meta-line">${escapeHtml(
              formatProspectusIndustryAndCompanySize(s1.industry, s1.companySize)
            )}</b>
            <span>${escapeHtml(s1.registeredCountry)}</span>
          </div>
        </div>
        <p>${escapeHtml(s1.businessDescription)}</p>
      </section>
      <section class="invoice-info" data-stage="2">
        <h2>${escapeHtml(s2.sectionHeading)}</h2>
        <dl class="page-two-invoice-list">
          <div class="page-two-invoice-row"><dt>${renderProspectusHeroicon("invoice-amount", { className: "icon page-two-invoice-icon" })}Invoice Amount</dt><dd>${escapeHtml(s2.invoiceAmount)}</dd></div>
          <div class="page-two-invoice-row"><dt>${renderProspectusHeroicon("invoice-date", { className: "icon page-two-invoice-icon" })}Invoice Due Date</dt><dd>${escapeHtml(s2.invoiceDueDate)}</dd></div>
          <div class="page-two-invoice-row"><dt>${renderProspectusHeroicon("paymaster-name", { className: "icon page-two-invoice-icon" })}Paymaster</dt><dd>${escapeHtml(s2.paymasterName)}</dd></div>
          <div class="page-two-invoice-row"><dt>${renderProspectusHeroicon("paymaster-type", { className: "icon page-two-invoice-icon" })}Nature of Paymaster</dt><dd>${escapeHtml(s2.paymasterNature)}</dd></div>
          <div class="page-two-invoice-row"><dt>${renderProspectusHeroicon("assignment", { className: "icon page-two-invoice-icon" })}Deed of Assignment (DOA)</dt><dd>${escapeHtml(s2.deedOfAssignment)}</dd></div>
        </dl>
      </section>
    </div>

    <section class="card financial-card page-two-financial-card connected-card-top">
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

    <section class="card split-card page-two-insights-card connected-card-bottom">
      <div data-stage="5">
        <h2>${escapeHtml(s5.sectionHeading)}</h2>
        <div class="ratings">
          ${ratingRow("MARC Credit Grade", s5.marcCreditGrade)}
          ${ratingRow("MARC Credit Score", s5.marcCreditScore)}
          ${ratingRow("Probability of Default", s5.probabilityOfDefault)}
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
        ${buildProspectusMarcRatingScaleSectionHtml()}
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
