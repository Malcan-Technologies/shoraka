/**
 * SECTION: Plain HTML for Page 3 Stage 2 income statement preview
 * WHY: Heading + year columns + seven rows only — audit/source paths excluded
 */

import type { ProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-page-three-income-statement.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusPageThreeIncomeStatementHtml(
  data: ProspectusPageThreeIncomeStatement
): string {
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 3 — 3-Year Income Statement Summary</title>
</head>
<body>
  <h1>Prospectus Page 3 — DATA STAGE 2: Income Statement Summary</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <table border="1" cellpadding="6" cellspacing="0">
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
  </section>
</body>
</html>`;
}
