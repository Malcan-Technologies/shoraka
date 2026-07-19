/**
 * SECTION: Plain HTML for Historical Note Table Canva-facing preview
 * WHY: Exact Canva columns only — audit/supporting amount/date columns excluded
 */

import {
  PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS,
  type ProspectusHistoricalNoteTable,
  type ProspectusHistoricalNoteTableRow,
} from "./prospectus-historical-note-table.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CANVA_KEYS: Array<keyof Omit<ProspectusHistoricalNoteTableRow, "audit">> = [
  "noteId",
  "financingType",
  "amountRm",
  "tenure",
  "profitRate",
  "status",
  "repaymentDate",
];

export function buildProspectusHistoricalNoteTableHtml(
  table: ProspectusHistoricalNoteTable
): string {
  const header = PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS.map(
    (label) => `<th>${escapeHtml(label)}</th>`
  ).join("");

  // Plain empty body — do not invent "No prior notes" / first-issuance claims.
  const body =
    table.rows.length === 0
      ? ""
      : table.rows
          .map((row) => {
            const cells = CANVA_KEYS.map(
              (key) => `<td>${escapeHtml(row[key])}</td>`
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
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
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
