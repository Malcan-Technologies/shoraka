/**
 * SECTION: Plain HTML for Note Identity data preview
 * WHY: Unstyled proof that the four identity values can be shown
 */

import type { ProspectusNoteIdentity } from "./prospectus-note-identity.types";
import { PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES } from "./prospectus-note-identity.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusNoteIdentityHtml(identity: ProspectusNoteIdentity): string {
  const rows: Array<{ key: keyof ProspectusNoteIdentity; displayLabel: string }> = [
    { key: "investmentNoteLabel", displayLabel: "Investment Note" },
    { key: "noteReference", displayLabel: "Note reference" },
    { key: "financingType", displayLabel: "Financing type" },
    { key: "description", displayLabel: "Description" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES[key];
      return `<tr>
  <td>${escapeHtml(displayLabel)}</td>
  <td>${escapeHtml(identity[key])}</td>
  <td>${escapeHtml(source.canonicalSource)}</td>
  <td>${escapeHtml(source.availability)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Note Identity</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 1: Note Identity</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>
    Investment Note: ${escapeHtml(identity.investmentNoteLabel)}<br />
    Note reference: ${escapeHtml(identity.noteReference)}<br />
    Financing type: ${escapeHtml(identity.financingType)}<br />
    Description: ${escapeHtml(identity.description)}
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
