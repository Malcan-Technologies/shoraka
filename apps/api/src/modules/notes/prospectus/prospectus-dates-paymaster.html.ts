/**
 * SECTION: Plain HTML for Dates & Paymaster data preview
 * WHY: Unstyled Stage 2 proof — Closing Date is a template extension; visual placement pending
 */

import type { ProspectusDatesPaymaster } from "./prospectus-dates-paymaster.types";
import { PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES } from "./prospectus-dates-paymaster.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusDatesPaymasterHtml(data: ProspectusDatesPaymaster): string {
  const rows: Array<{ key: keyof ProspectusDatesPaymaster; displayLabel: string }> = [
    { key: "listingDate", displayLabel: "Listing date" },
    { key: "closingDate", displayLabel: "Listing Closing Date" },
    { key: "maturityDate", displayLabel: "Maturity date (source)" },
    { key: "tenure", displayLabel: "Tenure (source)" },
    { key: "maturityDateWithTenure", displayLabel: "Maturity date" },
    { key: "paymasterName", displayLabel: "Paymaster name (source)" },
    { key: "paymasterEntityType", displayLabel: "Paymaster entity type (source)" },
    { key: "paymasterDisplay", displayLabel: "Paymaster" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES[key];
      return `<tr>
  <td>${escapeHtml(displayLabel)}</td>
  <td>${escapeHtml(data[key])}</td>
  <td>${escapeHtml(source.canonicalSource)}</td>
  <td>${escapeHtml(source.availability)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Dates and Paymaster</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 2: Dates and Paymaster</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>Listing Closing Date uses note_listings.closes_at only (scheduled). notes.funding_closed_at is not used. Final visual placement of Closing Date is pending (not in original Canva).</p>
  <p>
    Listing date: ${escapeHtml(data.listingDate)}<br />
    Closing date: ${escapeHtml(data.closingDate)}<br />
    Maturity date: ${escapeHtml(data.maturityDateWithTenure)}<br />
    Paymaster: ${escapeHtml(data.paymasterDisplay)}
  </p>
  <p>
    Tenure (source): ${escapeHtml(data.tenure)}<br />
    Maturity date (source): ${escapeHtml(data.maturityDate)}<br />
    Paymaster name (source): ${escapeHtml(data.paymasterName)}<br />
    Paymaster entity type (source): ${escapeHtml(data.paymasterEntityType)}
  </p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>Label</th>
        <th>Value</th>
        <th>Canonical source</th>
        <th>Availability</th>
      </tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
</body>
</html>`;
}
