/**
 * SECTION: Plain HTML for Page 2 Invoice & Paymaster Information preview
 * WHY: Unstyled Canva-facing rows only — audit/source paths excluded
 */

import type { ProspectusInvoicePaymaster } from "./prospectus-invoice-paymaster.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusInvoicePaymasterHtml(
  data: ProspectusInvoicePaymaster
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — Invoice &amp; Paymaster Information</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 2: Invoice &amp; Paymaster Information</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>
      Invoice Amount: ${escapeHtml(data.invoiceAmount)}<br />
      Invoice Due Date: ${escapeHtml(data.invoiceDueDate)}<br />
      Paymaster: ${escapeHtml(data.paymasterName)}<br />
      Nature of Paymaster<br />${escapeHtml(data.paymasterNature)}<br />
      Deed of Assignment (DOA)<br />${escapeHtml(data.deedOfAssignment)}<br />
      Paymaster Rating: ${escapeHtml(data.paymasterRating)}<br />
      Confidence Grading: ${escapeHtml(data.confidenceGrading)}
    </p>
  </section>
</body>
</html>`;
}
