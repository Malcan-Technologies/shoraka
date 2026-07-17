/**
 * SECTION: Plain HTML for Historical Note Table preview
 * WHY: Unstyled Stage 8 proof — no design; no Prisma
 */

import type { ProspectusHistoricalNoteTableRow } from "./prospectus-historical-note-table.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COLUMNS: Array<{ key: keyof ProspectusHistoricalNoteTableRow; header: string }> = [
  { key: "noteReference", header: "Note reference" },
  { key: "financingType", header: "Financing type" },
  { key: "canvaAmountRm", header: "Amount (RM) [Canva unresolved]" },
  { key: "financingTarget", header: "Financing target" },
  { key: "fundedAmount", header: "Funded amount" },
  { key: "grossProfitRate", header: "Gross profit rate (p.a.)" },
  { key: "tenure", header: "Tenure" },
  { key: "listingDate", header: "Listing date" },
  { key: "activationDate", header: "Activation date" },
  { key: "maturityDate", header: "Maturity date" },
  { key: "actualRepaymentDate", header: "Actual repayment date" },
  { key: "noteStatus", header: "Note status" },
  { key: "repaymentPerformanceLabel", header: "Repayment-performance label" },
];

export function buildProspectusHistoricalNoteTableHtml(
  rows: ProspectusHistoricalNoteTableRow[]
): string {
  const header = COLUMNS.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body =
    rows.length === 0
      ? `<tr><td colspan="${COLUMNS.length}">No historical rows</td></tr>`
      : rows
          .map((row) => {
            const cells = COLUMNS.map(
              (c) => `<td>${escapeHtml(row[c.key])}</td>`
            ).join("");
            return `<tr>${cells}</tr>`;
          })
          .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Historical Note Table</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 8: Historical Note Table</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>Grouping: notes.issuer_organization_id. Current Note excluded by notes.id. No NoteStatus eligibility filter. No sort or row limit. Live at generation time (not frozen). Canva Amount (RM) unresolved (target vs funded). Status is raw NoteStatus — not on-time performance.</p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>${header}</tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
</body>
</html>`;
}
