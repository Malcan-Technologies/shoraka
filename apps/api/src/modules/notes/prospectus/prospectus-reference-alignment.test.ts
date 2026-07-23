/**
 * SECTION: Reference-first visual alignment checks (Pages 1–3)
 * WHY: Prove subtitle, Sector format, semantic icons, shared header, 3 pages
 */

import { formatProspectusIndustryAndCompanySize } from "./prospectus-industry-company-size";
import { buildProspectusHeader } from "./prospectus-header";
import { buildProspectusHeaderHtml } from "./prospectus-header.html";
import { resolveProspectusOfficialLogoAbsolutePath } from "./prospectus-header-logo";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "./prospectus-page-one.sample-data";
import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "./prospectus-page-three.sample-data";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "./prospectus-page-two.sample-data";
import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";
import {
  PROSPECTUS_DOCUMENT_CSS,
  PROSPECTUS_HEADER_HEIGHT_PX,
  PROSPECTUS_LOGO_HEIGHT_PX,
  PROSPECTUS_LOGO_MAX_WIDTH_PX,
  PROSPECTUS_PAGE_PADDING_BOTTOM_PX,
  PROSPECTUS_PAGE_PADDING_CSS,
  PROSPECTUS_PAGE_PADDING_TOP_PX,
  PROSPECTUS_PAGE_PADDING_X_PX,
  PROSPECTUS_PAGE_TITLE_FONT_SIZE_PX,
  PROSPECTUS_SECTION_TITLE_FONT_SIZE_PX,
  PROSPECTUS_TAGLINE_FONT_SIZE_PX,
} from "./prospectus-document-styles";
import {
  PROSPECTUS_DETAILED_FINANCIAL_SUBTITLE,
  PROSPECTUS_HEADER_TAGLINE,
} from "./prospectus-static-copy";
import { combineProspectusPagesHtml } from "./combine-prospectus-pages-html";

describe("prospectus reference alignment (Pages 1–3)", () => {
  it("formats Industry | Company Size with shared helper", () => {
    expect(formatProspectusIndustryAndCompanySize("Industrial Manufacturing", "Medium")).toBe(
      "Industrial Manufacturing | Medium"
    );
    expect(formatProspectusIndustryAndCompanySize("Industrial Manufacturing", null)).toBe(
      "Industrial Manufacturing | —"
    );
    expect(formatProspectusIndustryAndCompanySize(null, "Medium")).toBe("— | Medium");
    expect(formatProspectusIndustryAndCompanySize(null, null)).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
  });

  it("Page 3 subtitle appears once between title and metadata strip", () => {
    const html = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    const titleIdx = html.indexOf("DETAILED FINANCIAL COMPARISON");
    const subtitleIdx = html.indexOf(PROSPECTUS_DETAILED_FINANCIAL_SUBTITLE);
    const metaIdx = html.indexOf('data-content-stage="metadata-strip"');
    expect(subtitleIdx).toBeGreaterThan(titleIdx);
    expect(metaIdx).toBeGreaterThan(subtitleIdx);
    expect(html.split(PROSPECTUS_DETAILED_FINANCIAL_SUBTITLE).length - 1).toBe(1);
    expect(html).not.toMatch(
      /DETAILED FINANCIAL COMPARISON[\s\S]{0,80}—[\s\S]{0,80}metadata-strip/
    );
  });

  it("Page 3 metadata uses distinct semantic icons", () => {
    const html = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    const stripStart = html.indexOf('data-content-stage="metadata-strip"');
    const stripEnd = html.indexOf('data-content-stage="income-statement"', stripStart);
    const strip = html.slice(stripStart, stripEnd);
    const iconCount = (strip.match(/class="icon"/g) ?? []).length;
    expect(iconCount).toBe(5);
    // Not five identical calendar-only marks: building / shield / landmark paths differ
    expect(strip).toContain('data-meta-key="sector"');
    expect(strip).toContain('data-meta-key="riskRating"');
    expect(strip).toContain('data-meta-key="paymaster"');
    expect(strip).toContain('data-meta-key="paymasterGrading"');
    expect(strip).toContain('data-meta-key="confidenceGrading"');
    const sectorChunk = strip.slice(
      strip.indexOf('data-meta-key="sector"'),
      strip.indexOf('data-meta-key="riskRating"')
    );
    const riskChunk = strip.slice(
      strip.indexOf('data-meta-key="riskRating"'),
      strip.indexOf('data-meta-key="paymaster"')
    );
    expect(sectorChunk).not.toEqual(riskChunk);
  });

  it("Investor Takeaways use category icons in approved order when visible", () => {
    const html = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    const keys = [
      "revenue_profitability",
      "liquidity",
      "leverage",
      "debt_servicing_capacity",
      "receivables_collection",
      "overall_financial_profile",
    ];
    let cursor = -1;
    for (const key of keys) {
      const idx = html.indexOf(`data-takeaway-key="${key}"`);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("Trend column keeps — when no approved direction exists", () => {
    const html = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    expect(html).toContain("Trend (3-Yr)");
    expect((html.match(/class="trend-cell"/g) ?? []).length).toBe(10);
    expect(html).not.toMatch(/trend-cell up|trend-cell down/);
    expect(html).not.toMatch(/[↑↓]/);
  });

  it("shared header uses official logo asset path and static tagline", () => {
    expect(resolveProspectusOfficialLogoAbsolutePath()).not.toBeNull();
    const header = buildProspectusHeader();
    expect(header.tagline).toBe(PROSPECTUS_HEADER_TAGLINE);
    const html = buildProspectusHeaderHtml(header);
    expect(html).toContain('class="brand-logo"');
    expect(html).toContain(PROSPECTUS_HEADER_TAGLINE);
    expect(html).toContain("data:image/svg+xml;base64,");
    expect(html).not.toContain('class="brand-name"');
    expect(html).not.toContain("Cash<span>Souk</span>");
    expect(html).toMatch(
      /class="brand-logo"[\s\S]*?class="tagline"/
    );
  });

  it("Pages 1–3 share the same header markup pattern", () => {
    const h1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    const h2 = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
    const h3 = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    for (const html of [h1, h2, h3]) {
      expect(html).toContain('data-stage="header"');
      expect(html).toContain("page-header");
      expect(html).toContain(PROSPECTUS_HEADER_TAGLINE);
      expect(html).toContain('class="brand-logo"');
      expect(html).toContain(`height="${PROSPECTUS_LOGO_HEIGHT_PX}"`);
      expect(html).not.toContain('class="brand-name"');
    }
  });

  it("uses shared header/logo/title tokens with no per-page shrink overrides", () => {
    expect(PROSPECTUS_HEADER_HEIGHT_PX).toBe(66);
    expect(PROSPECTUS_LOGO_HEIGHT_PX).toBe(56);
    expect(PROSPECTUS_LOGO_MAX_WIDTH_PX).toBe(210);
    expect(PROSPECTUS_TAGLINE_FONT_SIZE_PX).toBe(8.5);
    expect(PROSPECTUS_SECTION_TITLE_FONT_SIZE_PX).toBe(12);
    expect(PROSPECTUS_PAGE_TITLE_FONT_SIZE_PX).toBe(22);
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(
      "height:var(--prospectus-logo-height)"
    );
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(
      "font-size:var(--prospectus-section-title-font-size)"
    );
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(
      "font-size:var(--prospectus-page-title-font-size)"
    );
    // Page 2 must not shrink shared section titles or header logo
    expect(PROSPECTUS_DOCUMENT_CSS).not.toMatch(
      /\.prospectus-page-two[^{]*\{[^}]*\.cta h2[^}]*font-size/
    );
    expect(PROSPECTUS_DOCUMENT_CSS).not.toMatch(
      /\.prospectus-page-two[^{]*h2\{[^}]*font-size:\s*11px/
    );
    expect(PROSPECTUS_DOCUMENT_CSS).not.toMatch(
      /\.prospectus-page-(one|two|three)[^{]*\{[^}]*--prospectus-logo-height/
    );
  });

  it("Pages 1–3 use the same shared outer page padding token", () => {
    expect(PROSPECTUS_PAGE_PADDING_CSS).toBe("38px 28px 28px");
    expect(PROSPECTUS_PAGE_PADDING_TOP_PX).toBe(38);
    expect(PROSPECTUS_PAGE_PADDING_X_PX).toBe(28);
    expect(PROSPECTUS_PAGE_PADDING_BOTTOM_PX).toBe(28);
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(
      "padding:var(--prospectus-page-padding)"
    );
    expect(PROSPECTUS_DOCUMENT_CSS).not.toMatch(
      /\.prospectus-page-(one|two|three)\s*\{[^}]*padding:/
    );
    const h1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    const h2 = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
    const h3 = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    for (const html of [h1, h2, h3]) {
      expect(html).toContain("padding:var(--prospectus-page-padding)");
      expect(html).not.toMatch(/\.prospectus-page-two\{padding:/);
    }
  });

  it("combined document remains exactly three A4 pages without page-bottom spacer", () => {
    const combined = combineProspectusPagesHtml({
      page1: buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE),
      page2: buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO),
      page3: buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE),
    });
    expect(
      combined.match(/data-page="prospectus-page-(one|two|three)"/g)?.length
    ).toBe(3);
    expect(combined).not.toContain("page-bottom");
  });
});

