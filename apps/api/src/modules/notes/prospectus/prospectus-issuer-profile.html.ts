/**
 * SECTION: Plain HTML for Page 2 About the Issuer preview
 * WHY: Non-identifying fields only — no company name / registration / entity type
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusIssuerProfile } from "./prospectus-issuer-profile.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatIssuerIndustrySizeLine(industry: string, companySize: string): string {
  const missingIndustry =
    !industry.trim() || industry === PROSPECTUS_DATA_NOT_AVAILABLE;
  const missingSize =
    !companySize.trim() || companySize === PROSPECTUS_DATA_NOT_AVAILABLE;
  if (missingIndustry && missingSize) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return `${missingIndustry ? PROSPECTUS_DATA_NOT_AVAILABLE : industry} | ${
    missingSize ? PROSPECTUS_DATA_NOT_AVAILABLE : companySize
  }`;
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
        <p class="issuer-meta-line">${escapeHtml(
          formatIssuerIndustrySizeLine(data.industry, data.companySize)
        )}</p>
        <p>${escapeHtml(data.registeredCountry)}</p>
        <p>${escapeHtml(data.businessDescription)}</p>
      </div>
    </div>
  </section>
</body>
</html>`;
}
