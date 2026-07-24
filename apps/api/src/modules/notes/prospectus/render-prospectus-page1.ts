/**
 * SECTION: Prospectus page-1 PDF orchestration (POC)
 * WHY: Compose sample/view-model data → HTML → Playwright PDF without Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAGE1_DATA } from "./prospectus.sample-data";
import { buildProspectusPage1Html } from "./prospectus-page1.html";
import type { ProspectusPage1Data } from "./prospectus.types";
import { renderProspectusHtmlToPdfBuffer } from "./render-prospectus-html-to-pdf";

export function buildProspectusPage1Document(data: ProspectusPage1Data = SAMPLE_PROSPECTUS_PAGE1_DATA): string {
  return buildProspectusPage1Html(data);
}

export async function renderProspectusPage1Pdf(
  data: ProspectusPage1Data = SAMPLE_PROSPECTUS_PAGE1_DATA
): Promise<Buffer> {
  const html = buildProspectusPage1Document(data);
  return renderProspectusHtmlToPdfBuffer(html);
}
