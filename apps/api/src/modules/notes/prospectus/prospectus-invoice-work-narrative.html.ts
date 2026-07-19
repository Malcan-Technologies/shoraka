/**
 * SECTION: Plain HTML for Page 2 About the Invoice / Work Performed preview
 * WHY: Unstyled Canva-facing fields only — audit/evidence paths excluded
 */

import type { ProspectusInvoiceWorkNarrative } from "./prospectus-invoice-work-narrative.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusInvoiceWorkNarrativeHtml(
  data: ProspectusInvoiceWorkNarrative
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — About the Invoice / Work Performed</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 6: About the Invoice / Work Performed</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>
      Work Under Contract Statement: ${escapeHtml(data.workUnderContractStatement)}<br />
      Certification and Acceptance Statement: ${escapeHtml(data.certificationAcceptanceStatement)}<br />
      Paymaster-to-Trust-Account Statement: ${escapeHtml(data.paymasterTrustAccountStatement)}<br />
      Deed of Assignment Statement: ${escapeHtml(data.deedOfAssignmentStatement)}
    </p>
  </section>
</body>
</html>`;
}
