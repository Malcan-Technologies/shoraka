/**
 * SECTION: Page 2 Stage 8 composition — header + CTA
 * WHY: Standalone preview; reusable layout modules; no Prisma
 */

import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { buildProspectusInvestmentCtaHtml } from "./prospectus-investment-cta.html";
import {
  SAMPLE_PROSPECTUS_HEADER,
  SAMPLE_PROSPECTUS_INVESTMENT_CTA,
} from "./prospectus-investment-cta.sample-data";
import type { ProspectusHeader } from "./prospectus-header.types";
import type { ProspectusInvestmentCta } from "./prospectus-investment-cta.types";

export interface ProspectusInvestmentCtaDocumentParts {
  header?: ProspectusHeader;
  cta?: ProspectusInvestmentCta;
}

export function buildProspectusInvestmentCtaDocument(
  parts: ProspectusInvestmentCtaDocumentParts = {}
): string {
  const header = parts.header ?? SAMPLE_PROSPECTUS_HEADER;
  const cta = parts.cta ?? SAMPLE_PROSPECTUS_INVESTMENT_CTA;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 2 — CTA and Shared Header</title>
</head>
<body>
  <h1>Prospectus Page 2 — DATA STAGE 8: CTA and Shared Header</h1>
  <p>Static CTA preview. Live invest controls remain on the investor marketplace.</p>
  ${buildProspectusHeaderHtml(header)}
  ${buildProspectusInvestmentCtaHtml(cta)}
</body>
</html>`;
}
