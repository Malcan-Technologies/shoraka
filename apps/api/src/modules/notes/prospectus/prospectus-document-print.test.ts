/**
 * SECTION: Prospectus A4 / print / combine presentation tests
 * WHY: Lock fixed A4 geometry, no viewport reflow, three-page combine for PDF
 */

import { combineProspectusPagesHtml, extractProspectusPageSection } from "./combine-prospectus-pages-html";
import {
  PROSPECTUS_A4_HEIGHT_MM,
  PROSPECTUS_A4_WIDTH_MM,
  PROSPECTUS_DOCUMENT_CSS,
} from "./prospectus-document-styles";
import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "./prospectus-page-one.sample-data";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "./prospectus-page-three.sample-data";
import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "./prospectus-page-two.sample-data";

describe("prospectus document A4 and print CSS", () => {
  it("locks each .page to fixed A4 mm sizes including min-width and min-height", () => {
    expect(PROSPECTUS_A4_WIDTH_MM).toBe(210);
    expect(PROSPECTUS_A4_HEIGHT_MM).toBe(297);
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("width:var(--prospectus-a4-width)");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("height:var(--prospectus-a4-height)");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("min-width:var(--prospectus-a4-width)");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("min-height:var(--prospectus-a4-height)");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(`--prospectus-a4-width:${PROSPECTUS_A4_WIDTH_MM}mm`);
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(`--prospectus-a4-height:${PROSPECTUS_A4_HEIGHT_MM}mm`);
  });

  it("does not include viewport max-width media queries that reflow grids or stack sections", () => {
    expect(PROSPECTUS_DOCUMENT_CSS).not.toMatch(/@media\s*\(\s*max-width/i);
    expect(PROSPECTUS_DOCUMENT_CSS).not.toMatch(/@media\s+screen/i);
    const mediaBlocks = PROSPECTUS_DOCUMENT_CSS.match(/@media[^{]+\{/g) ?? [];
    expect(mediaBlocks).toEqual(["@media print{"]);
  });

  it("keeps grey canvas as preview-only html background and white page surface", () => {
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/html\{[^}]*background:#ececec/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/\.page\{[^}]*background:#fff/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/\.document\{[^}]*padding:24px 0/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/box-shadow:0 4px 24px/);
  });

  it("print CSS removes preview chrome and keeps A4 with print backgrounds", () => {
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("print-color-adjust:exact");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("-webkit-print-color-adjust:exact");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("@page{size:A4;margin:0}");
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(
      /@media print\{[\s\S]*html,body,\.document\{[\s\S]*background:#fff/
    );
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/@media print\{[\s\S]*\.document\{[\s\S]*padding:0/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/@media print\{[\s\S]*box-shadow:none/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/@media print\{[\s\S]*min-width:210mm/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/@media print\{[\s\S]*min-height:297mm/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/@media print\{[\s\S]*width:210mm/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/@media print\{[\s\S]*height:297mm/);
  });
});

describe("combineProspectusPagesHtml", () => {
  const page1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
  const page2 = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
  const page3 = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);

  it("extracts the full .page section including nested inner sections", () => {
    const section = extractProspectusPageSection(page1);
    expect(section).toContain('data-page="prospectus-page-one"');
    expect(section).toContain('class="page prospectus-page-one"');
    expect(section.startsWith("<section")).toBe(true);
    expect(section.endsWith("</section>")).toBe(true);
    expect((section.match(/<section\b/gi) ?? []).length).toBe(
      (section.match(/<\/section>/gi) ?? []).length
    );
    expect(section).toContain("prospectus-footer");
  });

  it("builds one document with exactly three A4 .page nodes", () => {
    const combined = combineProspectusPagesHtml({ page1, page2, page3 });
    expect(combined.match(/<!DOCTYPE html>/g)?.length).toBe(1);
    expect(combined.match(/<section\b[^>]*\bclass="[^"]*\bpage\b/g)?.length).toBe(3);
    expect(combined).toContain('data-page="prospectus-page-one"');
    expect(combined).toContain('data-page="prospectus-page-two"');
    expect(combined).toContain('data-page="prospectus-page-three"');
    expect(combined).not.toContain("<hr");
    expect(combined).toContain(PROSPECTUS_DOCUMENT_CSS.slice(0, 40));
    expect(combined).toContain("<b>Closing Date</b>");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".key-dates .meta-row{margin-bottom:12px}");
  });
});
