import { MARC_SCORE_DEFINITIONS, MARC_SME_GRADES } from "@cashsouk/types";
import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { escapeHtml } from "./prospectus-html";
import {
  MARC_APPENDIX_FACTOR_FOOTNOTE,
  MARC_APPENDIX_FACTOR_ROWS,
  MARC_APPENDIX_METHODOLOGY_PARAGRAPHS,
  MARC_CUSTOMER_SERVICE_HTML_PARAGRAPHS,
  MARC_CUSTOMER_SERVICE_INQUIRY_ITEMS,
  MARC_DISCLAIMER_CLOSING_PARAGRAPHS,
  MARC_DISCLAIMER_PARAGRAPHS,
  MARC_DISCLAIMER_UPPERCASE,
} from "./prospectus-marc-disclaimer";
import { PROSPECTUS_STRATO_CSS } from "./prospectus-strato-styles";
import {
  PROSPECTUS_PAGE_ONE_HEIGHT_MM,
  PROSPECTUS_PAGE_ONE_WIDTH_MM,
} from "./prospectus-page-one.types";

function wrapStratoPage(inner: string, pageClass: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
${PROSPECTUS_DOCUMENT_CSS}
${PROSPECTUS_STRATO_CSS}
.page.strato-page{
  width:${PROSPECTUS_PAGE_ONE_WIDTH_MM}mm;
  height:${PROSPECTUS_PAGE_ONE_HEIGHT_MM}mm;
  min-width:${PROSPECTUS_PAGE_ONE_WIDTH_MM}mm;
  min-height:${PROSPECTUS_PAGE_ONE_HEIGHT_MM}mm;
}
  </style>
</head>
<body>
  <main class="document">
  <section class="page strato-page ${pageClass}" data-page="${pageClass}">
${inner}
  </section>
  </main>
</body>
</html>`;
}

function stratoHeader(): string {
  return `<header class="strato-header">
  <div class="strato-marc-logo">MARC</div>
  <div class="strato-report-title"><div>MARC SME Credit</div><div>Methodology</div></div>
</header>`;
}

export function buildProspectusPageFourHtml(): string {
  const scoreRows = MARC_SME_GRADES.map((grade) => {
    const def = MARC_SCORE_DEFINITIONS[grade];
    return `<tr><td>${escapeHtml(grade)}</td><td>${escapeHtml(def.scoreRange)}</td><td>${escapeHtml(
      def.pd
    )}</td><td>${escapeHtml(def.riskProfile)}</td></tr>`;
  }).join("\n");
  const methodology = MARC_APPENDIX_METHODOLOGY_PARAGRAPHS.map(
    (paragraph) => `<p>${escapeHtml(paragraph)}</p>`
  ).join("\n");
  const factors = MARC_APPENDIX_FACTOR_ROWS.map(
    (row) =>
      `<tr><td><strong>${escapeHtml(row.title)}</strong><br>${escapeHtml(row.body)}</td></tr>`
  ).join("\n");

  const inner = `${stratoHeader()}
  <div class="strato-section-title">MARC SCORE DEFINITIONS</div>
  <div class="strato-table-wrap">
    <table class="strato-table strato-score-table">
      <thead><tr><th>Credit Grade</th><th>Credit Score</th><th>PD</th><th>Risk Profile</th></tr></thead>
      <tbody>
${scoreRows}
      </tbody>
    </table>
  </div>
  <div class="strato-section-title strato-methodology-title">CREDIT SCORING METHODOLOGIES</div>
  <div class="strato-copy">
${methodology}
  </div>
  <div class="strato-table-wrap">
    <table class="strato-table strato-factors-table">
      <thead><tr><th>Financial &amp; Non-Financial Factors</th></tr></thead>
      <tbody>
${factors}
      </tbody>
    </table>
  </div>
  <p class="strato-footnote"><em>${escapeHtml(MARC_APPENDIX_FACTOR_FOOTNOTE)}</em></p>
  <div class="strato-confidential">STRICTLY CONFIDENTIAL</div>`;

  return wrapStratoPage(inner, "prospectus-page-four", "Prospectus Page 4");
}

export function buildProspectusPageFiveHtml(): string {
  const service = MARC_CUSTOMER_SERVICE_HTML_PARAGRAPHS.map((html) => `<p>${html}</p>`).join("\n");
  const items = MARC_CUSTOMER_SERVICE_INQUIRY_ITEMS.map(
    (item) => `<li>${escapeHtml(item)}</li>`
  ).join("");
  const disclaimer = MARC_DISCLAIMER_PARAGRAPHS.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join(
    "\n"
  );
  const closing = MARC_DISCLAIMER_CLOSING_PARAGRAPHS.map(
    (paragraph) => `<p>${escapeHtml(paragraph)}</p>`
  ).join("\n");

  const inner = `${stratoHeader()}
  <div class="strato-section-title">CUSTOMER SERVICE</div>
  <div class="strato-final-copy">
${service}
    <ul>${items}</ul>
  </div>
  <div class="strato-section-title strato-disclaimer-title">DISCLAIMER AND CONFIDENTIALITY</div>
  <div class="strato-disclaimer-copy">
${disclaimer}
    <p class="strato-uppercase">${escapeHtml(MARC_DISCLAIMER_UPPERCASE)}</p>
${closing}
    <div class="strato-end-report">---------------------------- END OF REPORT ----------------------------</div>
  </div>
  <div class="strato-confidential">STRICTLY CONFIDENTIAL</div>`;

  return wrapStratoPage(inner, "prospectus-page-five strato-final-page", "Prospectus Page 5");
}
