/**
 * SECTION: Full Prospectus Page 2 HTML assembly
 * WHY: One A4 document; Stage 1–8 Canva-facing sections; no audit/Prisma IDs/source paths
 */

import { escapeHtml } from "./prospectus-html";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { buildProspectusInvestmentCtaHtml } from "./prospectus-investment-cta.html";
import type { ProspectusPageTwo } from "./prospectus-page-two.types";
import {
  PROSPECTUS_PAGE_TWO_HEIGHT_MM,
  PROSPECTUS_PAGE_TWO_WIDTH_MM,
} from "./prospectus-page-two.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import { buildProspectusSoukscoreRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";

function renderFinancialTable(page: ProspectusPageTwo): string {
  const data = page.financialComparisonMetrics;
  const yearHeaders =
    data.years.length === 0
      ? `<th>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</th>`
      : data.years
          .map(
            (year) =>
              `<th>${escapeHtml(year.yearLabel)}<br /><span>${escapeHtml(
                year.financialYearEndLabel
              )}</span></th>`
          )
          .join("");

  const bodyRows =
    data.years.length === 0
      ? data.rows
          .map(
            (row) =>
              `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(
                PROSPECTUS_DATA_NOT_AVAILABLE
              )}</td></tr>`
          )
          .join("\n")
      : data.rows
          .map((row) => {
            const cells = row.values
              .map((value) => `<td>${escapeHtml(value)}</td>`)
              .join("");
            return `<tr><th scope="row">${escapeHtml(row.label)}</th>${cells}</tr>`;
          })
          .join("\n");

  return `<section data-stage="4">
  <h2>${escapeHtml(data.sectionHeading)}</h2>
  <table class="fin-table" border="1" cellpadding="6" cellspacing="0">
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
  <p class="fin-source">${escapeHtml(data.sourceFooter)}</p>
</section>`;
}

function renderSoukscoreScale(page: ProspectusPageTwo): string {
  return buildProspectusSoukscoreRatingScaleSectionHtml(page.soukscoreRatingScale);
}

function renderCta(page: ProspectusPageTwo): string {
  return buildProspectusInvestmentCtaHtml(page.investmentCta);
}

/**
 * Assembles Page 2 Canva-facing sections in approved order.
 * Ends after Investment CTA. Stage 4A is not a duplicate final section.
 */
export function buildProspectusPageTwoHtml(page: ProspectusPageTwo): string {
  const s1 = page.issuerProfile;
  const s2 = page.invoicePaymaster;
  const s3 = page.paymasterTrackRecord;
  const s5 = page.creditInsights;
  const s6 = page.invoiceWorkNarrative;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: ${PROSPECTUS_PAGE_TWO_WIDTH_MM}mm;
      min-height: ${PROSPECTUS_PAGE_TWO_HEIGHT_MM}mm;
      padding: 12mm;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    section, header { margin: 0; padding: 0; }
    h1, h2, h3 { margin: 0 0 6px; font-weight: 700; }
    h2 { font-size: 13px; }
    p { margin: 0; }
    .fin-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .fin-table th, .fin-table td { text-align: left; vertical-align: top; }
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
    .soukscore-missing { margin: 6px 0 0; }
    .cta-action { margin: 4px 0; }
    .cta-button {
      display: inline-block;
      padding: 6px 14px;
      border: 1px solid #111;
      background: #f3f3f3;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.02em;
      color: #111;
      cursor: default;
    }
    .cta-button[disabled],
    .cta-button[aria-disabled="true"] {
      opacity: 1;
      cursor: default;
      pointer-events: none;
    }
    .cta-minimum { margin: 0; }
    .issuer-profile-body {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .issuer-profile-content { flex: 1; min-width: 0; }
    .issuer-profile-content p { margin: 0 0 4px; }
    .issuer-profile-content p:last-child { margin-bottom: 0; }
    .icon {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      flex-shrink: 0;
      background: #0b3b2e;
      margin-top: 2px;
    }
    .icon-issuer {
      background: color-mix(in srgb, #0b3b2e 12%, white);
      border: 1px solid color-mix(in srgb, #0b3b2e 35%, white);
      position: relative;
    }
    .icon-issuer::after {
      content: "";
      position: absolute;
      inset: 4px;
      border-radius: 2px;
      background: #0b3b2e;
      opacity: 0.85;
    }
  </style>
</head>
<body>
  <div class="page" data-page="prospectus-page-two">
    ${buildProspectusHeaderHtml(page.header)}

    <section data-stage="1" data-issuer-profile>
      <h2>${escapeHtml(s1.sectionHeading)}</h2>
      <div class="issuer-profile-body">
        <span class="icon icon-issuer" aria-hidden="true"></span>
        <div class="issuer-profile-content">
          <p><strong>Industry</strong><br />${escapeHtml(s1.industry)}</p>
          <p><strong>Company Size</strong><br />${escapeHtml(s1.companySize)}</p>
          <p><strong>Registered Country</strong><br />${escapeHtml(s1.registeredCountry)}</p>
          <p><strong>Business Description</strong><br />${escapeHtml(s1.businessDescription)}</p>
        </div>
      </div>
    </section>

    <section data-stage="2">
      <h2>${escapeHtml(s2.sectionHeading)}</h2>
      <p>
        Invoice Amount: ${escapeHtml(s2.invoiceAmount)}<br />
        Invoice Due Date: ${escapeHtml(s2.invoiceDueDate)}<br />
        Paymaster: ${escapeHtml(s2.paymasterName)}<br />
        Nature of Paymaster: ${escapeHtml(s2.paymasterNature)}<br />
        Deed of Assignment (DOA): ${escapeHtml(s2.deedOfAssignment)}<br />
        Paymaster Rating: ${escapeHtml(s2.paymasterRating)}<br />
        Confidence Grading: ${escapeHtml(s2.confidenceGrading)}
      </p>
    </section>

    <section data-stage="3">
      <h2>${escapeHtml(s3.sectionHeading)}</h2>
      <p>
        Total Invoices Paid: ${escapeHtml(s3.totalInvoicesPaid)}<br />
        Total Amount Paid: ${escapeHtml(s3.totalAmountPaid)}<br />
        Successful Repayment: ${escapeHtml(s3.successfulRepaymentPercent)}<br />
        On-Time Payment: ${escapeHtml(s3.onTimePayment)}<br />
        Average Payment Period: ${escapeHtml(s3.averagePaymentPeriod)}
      </p>
    </section>

    ${renderFinancialTable(page)}

    <section data-stage="5">
      <h2>${escapeHtml(s5.sectionHeading)}</h2>
      <p>
        Credit Score: ${escapeHtml(s5.creditScore)}<br />
        Payment Behaviour: ${escapeHtml(s5.paymentBehaviour)}<br />
        Credit Utilisation: ${escapeHtml(s5.creditUtilisation)}<br />
        Litigation Check: ${escapeHtml(s5.litigationCheck)}<br />
        CCRIS Status: ${escapeHtml(s5.ccrisStatus)}
      </p>
    </section>

    <section data-stage="6">
      <h2>${escapeHtml(s6.sectionHeading)}</h2>
      <ul class="about-invoice-list">
        ${
          [
            s6.workUnderContractStatement,
            s6.certificationAcceptanceStatement,
            s6.paymasterTrustAccountStatement,
            s6.deedOfAssignmentStatement,
          ]
            .filter((text) => Boolean(text && text.trim()))
            .map((text) => `<li>${escapeHtml(text)}</li>`)
            .join("\n        ") ||
          `<li>${escapeHtml(PROSPECTUS_DATA_NOT_AVAILABLE)}</li>`
        }
      </ul>
    </section>

    ${renderSoukscoreScale(page)}
    ${renderCta(page)}
  </div>
</body>
</html>`;
}
