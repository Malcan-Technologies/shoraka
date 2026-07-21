/**
 * SECTION: Plain HTML for Page 2 About the Issuer preview
 * WHY: Non-identifying fields only — no company name / registration / entity type
 */

import type { ProspectusIssuerProfile } from "./prospectus-issuer-profile.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusIssuerProfileHtml(data: ProspectusIssuerProfile): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — About the Issuer</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 1: About the Issuer</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <section data-issuer-profile>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <div class="issuer-profile-body">
      <span class="icon icon-issuer" aria-hidden="true"></span>
      <div class="issuer-profile-content">
        <p><strong>Industry</strong><br />${escapeHtml(data.industry)}</p>
        <p><strong>Company Size</strong><br />${escapeHtml(data.companySize)}</p>
        <p><strong>Registered Country</strong><br />${escapeHtml(data.registeredCountry)}</p>
        <p><strong>Business Description</strong><br />${escapeHtml(data.businessDescription)}</p>
      </div>
    </div>
  </section>
</body>
</html>`;
}
