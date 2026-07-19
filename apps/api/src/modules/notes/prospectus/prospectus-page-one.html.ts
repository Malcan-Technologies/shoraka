/**
 * SECTION: Full Prospectus Page 1 HTML assembly
 * WHY: One A4 document; Stage 1–8 Canva-facing sections; no audit/Prisma IDs/source paths
 */

import type { ProspectusPageOne } from "./prospectus-page-one.types";
import {
  PROSPECTUS_PAGE_ONE_HEIGHT_MM,
  PROSPECTUS_PAGE_ONE_WIDTH_MM,
} from "./prospectus-page-one.types";
import { PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS } from "./prospectus-historical-note-table.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHistoricalTable(page: ProspectusPageOne): string {
  const table = page.historicalNoteTable;
  const header = PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS.map(
    (label) => `<th>${escapeHtml(label)}</th>`
  ).join("");

  if (table.rows.length === 0) {
    return `<table class="hist-table" border="1" cellpadding="6" cellspacing="0">
  <thead><tr>${header}</tr></thead>
  <tbody>
    <tr><td colspan="7">${escapeHtml(
      table.emptyStateMessage ?? "No notes are available yet."
    )}</td></tr>
  </tbody>
</table>`;
  }

  const body = table.rows
    .map((row) => {
      return `<tr>
  <td>${escapeHtml(row.noteId)}</td>
  <td>${escapeHtml(row.financingType)}</td>
  <td>${escapeHtml(row.amountRm)}</td>
  <td>${escapeHtml(row.tenure)}</td>
  <td>${escapeHtml(row.profitRate)}</td>
  <td>${escapeHtml(row.status)}</td>
  <td>${escapeHtml(row.repaymentDate)}</td>
</tr>`;
    })
    .join("\n");

  return `<table class="hist-table" border="1" cellpadding="6" cellspacing="0">
  <thead><tr>${header}</tr></thead>
  <tbody>
${body}
  </tbody>
</table>`;
}

/**
 * Assembles Stage 1–8 Canva-facing sections in approved order.
 * Uses stage view-models from builders; does not query Prisma.
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1</title>
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
      width: ${PROSPECTUS_PAGE_ONE_WIDTH_MM}mm;
      min-height: ${PROSPECTUS_PAGE_ONE_HEIGHT_MM}mm;
      padding: 12mm;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    section { margin: 0; padding: 0; }
    h1, h2, h3 { margin: 0 0 6px; font-weight: 700; }
    h1 { font-size: 16px; }
    h2 { font-size: 13px; }
    h3 { font-size: 12px; }
    p { margin: 0; }
    .hist-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .hist-table th, .hist-table td { text-align: left; vertical-align: top; }
  </style>
</head>
<body>
  <div class="page" data-page="prospectus-page-one">
    <section data-stage="1">
      <h1>${escapeHtml(s1.investmentNoteLabel)}</h1>
      <p>
        Note ID: ${escapeHtml(s1.noteReference)}<br />
        Financing Type: ${escapeHtml(s1.financingType)}<br />
        Product Description: ${escapeHtml(s1.description)}
      </p>
    </section>

    <section data-stage="2">
      <h2>Dates and Paymaster</h2>
      <p>
        Listing Date: ${escapeHtml(s2.listingDate)}<br />
        Closing Date: ${escapeHtml(s2.closingDate)}<br />
        Maturity Date: ${escapeHtml(s2.maturityDateWithTenure)}<br />
        Paymaster: ${escapeHtml(s2.paymasterDisplay)}
      </p>
    </section>

    <section data-stage="3">
      <h2>Risk Rating</h2>
      <p>
        Risk Rating: ${escapeHtml(s3.riskGrade)}<br />
        Risk label: ${escapeHtml(s3.riskLabel)}<br />
        Risk explanation: ${escapeHtml(s3.riskExplanation)}<br />
        Rating scale reference: ${escapeHtml(s3.ratingScaleReference)}
      </p>
    </section>

    <section data-stage="4a">
      <h2>Main Financial Terms</h2>
      <p>
        Financing Amount: ${escapeHtml(s4a.financingAmount)}<br />
        Minimum Investment: ${escapeHtml(s4a.minimumInvestment)}<br />
        Profit Rate (p.a.): ${escapeHtml(s4a.profitRate)}<br />
        Expected Return for Investment Period: ${escapeHtml(s4a.expectedReturnForInvestmentPeriod)}
      </p>
    </section>

    <section data-stage="4b">
      <h2>Timing and Purpose</h2>
      <p>
        Tenure: ${escapeHtml(s4b.tenure)}<br />
        Maturity Date: ${escapeHtml(s4b.maturityDate)}<br />
        Purpose of Financing: ${escapeHtml(s4b.purposeOfFinancing)}
      </p>
    </section>

    <section data-stage="4c">
      <h2>Payment Basis and Shariah Principle</h2>
      <p>
        Payment Basis: ${escapeHtml(s4c.paymentBasis)}<br />
        Shariah Principle: ${escapeHtml(s4c.shariahPrinciple)}
      </p>
    </section>

    <section data-stage="5a">
      <h2>Paymaster Highlight</h2>
      <p>
        Paymaster Name: ${escapeHtml(s5a.paymasterName)}<br />
        Paymaster Entity Type: ${escapeHtml(s5a.paymasterEntityType)}<br />
        Government Classification: ${escapeHtml(s5a.governmentClassification)}<br />
        Paymaster Payment Track Record: ${escapeHtml(s5a.paymasterPaymentTrackRecord)}<br />
        Highlight Title: ${escapeHtml(s5a.highlightTitle)}<br />
        Highlight Explanation: ${escapeHtml(s5a.highlightExplanation)}
      </p>
    </section>

    <section data-stage="5b">
      <h2>Issuer Fundamentals Highlight</h2>
      <p>
        Profitability Evidence: ${escapeHtml(s5b.profitabilityEvidence)}<br />
        Leverage Evidence: ${escapeHtml(s5b.leverageEvidence)}<br />
        Highlight Title: ${escapeHtml(s5b.highlightTitle)}<br />
        Highlight Explanation: ${escapeHtml(s5b.highlightExplanation)}
      </p>
    </section>

    <section data-stage="5c">
      <h2>Return Highlight</h2>
      <p>
        Annual Gross Profit Rate (p.a.): ${escapeHtml(s5c.annualGrossProfitRate)}<br />
        Tenure: ${escapeHtml(s5c.tenure)}<br />
        Annual Net Expected Return Rate (p.a.): ${escapeHtml(s5c.annualNetExpectedReturnRate)}<br />
        Expected Return for Investment Period: ${escapeHtml(s5c.expectedReturnForInvestmentPeriod)}<br />
        Return Classification: ${escapeHtml(s5c.returnClassification)}<br />
        Tenure Classification: ${escapeHtml(s5c.tenureClassification)}<br />
        Highlight Title: ${escapeHtml(s5c.highlightTitle)}<br />
        Highlight Explanation: ${escapeHtml(s5c.highlightExplanation)}
      </p>
    </section>

    <section data-stage="5d">
      <h2>Shariah Highlight</h2>
      <p>
        Shariah-Compliant Status: ${escapeHtml(s5d.shariahCompliantStatus)}<br />
        Shariah Principle: ${escapeHtml(s5d.specificShariahPrinciple)}<br />
        Evidence Source: ${escapeHtml(s5d.evidenceSource)}<br />
        Adviser or Approval Reference: ${escapeHtml(s5d.approvalOrAdviserReference)}<br />
        Highlight Title: ${escapeHtml(s5d.highlightTitle)}<br />
        Highlight Explanation: ${escapeHtml(s5d.highlightExplanation)}
      </p>
    </section>

    <section data-stage="6">
      <h2>At a Glance</h2>
      <p>
        Financing Amount: ${escapeHtml(s6.financingAmount)}<br />
        Profit Rate (p.a.): ${escapeHtml(s6.profitRate)}<br />
        Expected Return: ${escapeHtml(s6.expectedReturn)}<br />
        Tenure: ${escapeHtml(s6.tenure)}<br />
        Minimum Investment: ${escapeHtml(s6.minimumInvestment)}
      </p>
    </section>

    <section data-stage="7">
      <h2>${escapeHtml(s7.sectionHeading)}</h2>
      <p>
        Total Notes Funded: ${escapeHtml(s7.totalNotesFunded)}<br />
        Total Amount Funded: ${escapeHtml(s7.totalAmountFunded)}<br />
        Successful Repayment: ${escapeHtml(s7.successfulRepayment)}<br />
        ${escapeHtml(s7.onTimePaymentRateLabel)}: ${escapeHtml(s7.onTimePaymentRate)}
      </p>
    </section>

    <section data-stage="8">
      <h2>Historical Notes</h2>
      ${renderHistoricalTable(page)}
    </section>
  </div>
</body>
</html>`;
}
