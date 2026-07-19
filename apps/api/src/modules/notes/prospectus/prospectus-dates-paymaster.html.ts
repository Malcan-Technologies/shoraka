/**
 * SECTION: Plain HTML for Dates & Paymaster Canva-facing preview
 * WHY: Final visible order Listing → Closing → Maturity → Paymaster
 */

import type { ProspectusDatesPaymaster } from "./prospectus-dates-paymaster.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusDatesPaymasterHtml(data: ProspectusDatesPaymaster): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Dates and Paymaster</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 2: Dates and Paymaster</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <p>
      Listing Date: ${escapeHtml(data.listingDate)}<br />
      Closing Date: ${escapeHtml(data.closingDate)}<br />
      Maturity Date: ${escapeHtml(data.maturityDateWithTenure)}<br />
      Paymaster: ${escapeHtml(data.paymasterDisplay)}
    </p>
  </section>
</body>
</html>`;
}
