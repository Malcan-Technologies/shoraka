/**
 * SECTION: Plain Stage 1 HTML data preview
 * WHY: Prove note identity + investment terms can be shown; no design polish
 */

import {
  PROSPECTUS_STAGE1_FIELD_SOURCES,
  type ProspectusStage1FieldRow,
  type ProspectusStage1Terms,
} from "./prospectus.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STAGE1_KEYS: Array<keyof ProspectusStage1Terms> = [
  "noteReference",
  "financingType",
  "listingDate",
  "maturityDate",
  "paymaster",
  "financingAmount",
  "minimumInvestment",
  "profitRate",
  "expectedReturn",
  "tenure",
  "purposeOfFinancing",
  "paymentBasis",
  "shariahPrinciple",
];

export function buildProspectusStage1FieldRows(
  terms: ProspectusStage1Terms
): ProspectusStage1FieldRow[] {
  return STAGE1_KEYS.map((key) => {
    const source = PROSPECTUS_STAGE1_FIELD_SOURCES[key];
    return {
      key,
      label: source.label,
      value: terms[key],
      source,
    };
  });
}

/** Ugly plain HTML: label, value, source path, availability. */
export function buildProspectusStage1Html(terms: ProspectusStage1Terms): string {
  const rows = buildProspectusStage1FieldRows(terms)
    .map((row) => {
      const sourceLine = `${row.source.model} · ${row.source.path}`;
      return `<tr>
  <td>${escapeHtml(row.label)}</td>
  <td>${escapeHtml(row.value)}</td>
  <td>${escapeHtml(row.source.availability)}</td>
  <td>${escapeHtml(row.source.origin)}</td>
  <td>${escapeHtml(sourceLine)}</td>
  <td>${escapeHtml(row.source.existingApi)}</td>
  <td>${escapeHtml(row.source.notes)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Stage 1 data preview</title>
</head>
<body>
  <h1>Prospectus Page 1 — Stage 1 data preview</h1>
  <p>Note identity and basic investment terms. No design. Values are sample / placeholder.</p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>Label</th>
        <th>Value</th>
        <th>Availability</th>
        <th>Origin</th>
        <th>Model / path</th>
        <th>Existing API</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;
}
