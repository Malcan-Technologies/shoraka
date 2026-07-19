/**
 * SECTION: Plain HTML for Page 2 Paymaster Track Record preview
 * WHY: Unstyled Canva-facing metrics only — audit/grouping/issuer paths excluded
 */

import type { ProspectusPaymasterTrackRecord } from "./prospectus-paymaster-track-record.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusPaymasterTrackRecordHtml(
  data: ProspectusPaymasterTrackRecord
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — Paymaster Track Record</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 3: Paymaster Track Record</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>
      Total Invoices Paid: ${escapeHtml(data.totalInvoicesPaid)}<br />
      Total Amount Paid: ${escapeHtml(data.totalAmountPaid)}<br />
      Successful Repayment %: ${escapeHtml(data.successfulRepaymentPercent)}<br />
      On-time Payment: ${escapeHtml(data.onTimePayment)}<br />
      Average Payment Period: ${escapeHtml(data.averagePaymentPeriod)}
    </p>
  </section>
</body>
</html>`;
}
