/**
 * SECTION: Prospectus Heroicons — official map + About the Issuer building icon
 */

import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "./prospectus-page-one.sample-data";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "./prospectus-page-three.sample-data";
import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "./prospectus-page-two.sample-data";
import {
  PROSPECTUS_BUILDING_OFFICE_2_PATH_MARKER,
  PROSPECTUS_HEROICON_MAP,
  PROSPECTUS_LEGACY_BUILDING_PATH_MARKER,
  renderProspectusHeroicon,
  type ProspectusIconName,
} from "./prospectus-icons";
import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";

describe("prospectus Heroicons", () => {
  it("maps issuer to BuildingOffice2Icon and embeds its path", () => {
    expect(PROSPECTUS_HEROICON_MAP.issuer).toBe(BuildingOffice2Icon);
    const svg = renderProspectusHeroicon("issuer", { className: "icon" });
    expect(svg).toContain(PROSPECTUS_BUILDING_OFFICE_2_PATH_MARKER);
    expect(svg).toContain('data-prospectus-icon="issuer"');
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).not.toContain(PROSPECTUS_LEGACY_BUILDING_PATH_MARKER);
  });

  it("Page 2 About the Issuer uses BuildingOffice2Icon, not the legacy ladder/server icon", () => {
    const html = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
    expect(html).toContain('data-prospectus-icon="issuer"');
    expect(html).toContain(PROSPECTUS_BUILDING_OFFICE_2_PATH_MARKER);
    expect(html).not.toContain(PROSPECTUS_LEGACY_BUILDING_PATH_MARKER);
    expect(html).not.toContain("ServerStack");
    expect(html).not.toContain("data-lucide");
  });

  it("resolves every ProspectusIconName through the official Heroicon map", () => {
    const names = Object.keys(PROSPECTUS_HEROICON_MAP) as ProspectusIconName[];
    expect(names.length).toBeGreaterThanOrEqual(30);
    for (const name of names) {
      const svg = renderProspectusHeroicon(name);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain(`data-prospectus-icon="${name}"`);
      expect(svg).toContain('stroke-width="1.5"');
      expect(PROSPECTUS_HEROICON_MAP[name]).toBeTruthy();
    }
  });

  it("does not keep bespoke Lucide-style path helpers in Page 1–3 HTML", () => {
    const pages = [
      buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE),
      buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO),
      buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE),
    ];
    for (const html of pages) {
      expect(html).not.toContain(PROSPECTUS_LEGACY_BUILDING_PATH_MARKER);
      expect(html).not.toContain("data-lucide");
      expect(html).not.toContain("lucide-");
      expect(html).toContain("data-prospectus-icon=");
    }
  });

  it("keeps uploaded Shariah badge and risk shield assets (non-Heroicon exceptions)", () => {
    const page1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    expect(page1).toContain("shariah-badge");
    expect(page1).toContain("risk-shield-asset");
    expect(page1).toContain("data:image/svg+xml;base64,");
  });

  it("Page 2 invoice rows use seven distinct semantic icon keys", () => {
    const html = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
    const keys = [
      "invoice-amount",
      "invoice-date",
      "paymaster-name",
      "paymaster-type",
      "assignment",
      "rating",
      "confidence",
    ];
    for (const key of keys) {
      expect(html).toContain(`data-prospectus-icon="${key}"`);
    }
  });

  it("Page 3 metadata uses five semantic Heroicons", () => {
    const html = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    expect(html).toContain('data-prospectus-icon="sector"');
    expect(html).toContain('data-prospectus-icon="risk-rating"');
    expect(html).toContain('data-prospectus-icon="paymaster"');
    expect(html).toContain('data-prospectus-icon="rating"');
    expect(html).toContain('data-prospectus-icon="confidence"');
  });

  it("Page 3 takeaways use the required Heroicon keys", () => {
    const html = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    for (const key of [
      "revenue-profitability",
      "liquidity",
      "leverage",
      "debt-servicing",
      "receivables",
      "overall-profile",
    ]) {
      expect(html).toContain(`data-prospectus-icon="${key}"`);
    }
  });

  it("defines shared icon size/stroke/colour tokens", () => {
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("--prospectus-icon-stroke-width:1.5");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("--prospectus-icon-large-circle:58px");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("--prospectus-icon-large-size:30px");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("--prospectus-icon-color:");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("--prospectus-icon-background:");
  });

  it("Credit Insights keep square markers (no forced row Heroicons)", () => {
    const html = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
    const insightsStart = html.indexOf('data-stage="5"');
    const workStart = html.indexOf('data-stage="6"');
    const insights = html.slice(insightsStart, workStart);
    expect(insights).toContain('class="ratings"');
    expect(insights).not.toContain('data-prospectus-icon="credit-score"');
  });
});
