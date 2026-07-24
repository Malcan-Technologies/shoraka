/**
 * SECTION: Plain HTML for Note Identity Canva-facing preview
 * WHY: Unstyled Stage 1 — source paths and audit excluded from summary
 */

import type { ProspectusNoteIdentity } from "./prospectus-note-identity.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusNoteIdentityHtml(identity: ProspectusNoteIdentity): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Note Identity</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 1: Note Identity</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section>
    <h2>${escapeHtml(identity.investmentNoteLabel)}</h2>
    <p>
      Note ID: ${escapeHtml(identity.noteReference)}<br />
      Financing Type: ${escapeHtml(identity.financingType)}<br />
      Product Description: ${escapeHtml(identity.description)}
    </p>
  </section>
</body>
</html>`;
}