/**
 * SECTION: Plain HTML for Page 2 About the Issuer preview
 * WHY: Unstyled Canva-facing fields only — audit/source paths excluded
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
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <p>
      Company Name: ${escapeHtml(data.companyName)}<br />
      Registration Number: ${escapeHtml(data.registrationNumber)}<br />
      Industry: ${escapeHtml(data.industry)}<br />
      Company Size: ${escapeHtml(data.companySize)}<br />
      Registered Country: ${escapeHtml(data.registeredCountry)}<br />
      Business Description: ${escapeHtml(data.businessDescription)}
    </p>
  </section>
</body>
</html>`;
}
