/**
 * SECTION: Page 2 Stage 8 composition — header + CTA + footer
 * WHY: Standalone preview; reusable layout modules; no Prisma
 */

import { buildProspectusFooterHtml } from "./prospectus-footer.html";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { buildProspectusInvestmentCtaHtml } from "./prospectus-investment-cta.html";
import {
  SAMPLE_PROSPECTUS_FOOTER,
  SAMPLE_PROSPECTUS_HEADER,
  SAMPLE_PROSPECTUS_INVESTMENT_CTA,
} from "./prospectus-investment-cta.sample-data";
import type { ProspectusFooter } from "./prospectus-footer.types";
import type { ProspectusHeader } from "./prospectus-header.types";
import type { ProspectusInvestmentCta } from "./prospectus-investment-cta.types";

export interface ProspectusInvestmentCtaDocumentParts {
  header?: ProspectusHeader;
  cta?: ProspectusInvestmentCta;
  footer?: ProspectusFooter;
}

export function buildProspectusInvestmentCtaDocument(
  parts: ProspectusInvestmentCtaDocumentParts = {}
): string {
  const header = parts.header ?? SAMPLE_PROSPECTUS_HEADER;
  const cta = parts.cta ?? SAMPLE_PROSPECTUS_INVESTMENT_CTA;
  const footer = parts.footer ?? SAMPLE_PROSPECTUS_FOOTER;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — CTA and Shared Header / Footer</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 8: CTA and Shared Header / Footer</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  ${buildProspectusHeaderHtml(header)}
  ${buildProspectusInvestmentCtaHtml(cta)}
  ${buildProspectusFooterHtml(footer)}
</body>
</html>`;
}
