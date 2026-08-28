/**
 * SECTION: cashsouk-html-v3 visual contract for Page 1 Risk Rating + Page 2 scale
 * WHY: Production must reuse V3 badge/scale CSS, not a denser engineering layout
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  MARC_SCORE_DEFINITIONS,
  MARC_SME_BANDS,
  MARC_SME_GRADES,
  resolveMarcNoteRiskPresentation,
} from "@cashsouk/types";
import { chromium } from "playwright";
import { combineProspectusPagesHtml } from "./combine-prospectus-pages-html";
import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { buildProspectusPageFourHtml, buildProspectusPageFiveHtml } from "./prospectus-marc-appendix.html";
import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "./prospectus-page-one.sample-data";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "./prospectus-page-three.sample-data";
import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "./prospectus-page-two.sample-data";
import { countProspectusHtmlPages } from "./prospectus-pdf";
import { PROSPECTUS_RISK_SCALE_NOTE } from "./prospectus-static-copy";
import { buildProspectusMarcRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";

const ADMIN_PREVIEW_SCROLL_LOCK =
  "html,body{overflow-x:hidden!important;overflow-y:auto!important;width:100%!important;min-width:0!important;max-width:none!important;scrollbar-gutter:stable}" +
  ".document{width:100%!important;min-width:0!important;max-width:none!important}" +
  ".page{margin-left:auto!important;margin-right:auto!important}";

function resolveChromiumExecutablePath(): string | undefined {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (fromEnv) return fromEnv;
  for (const candidate of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/lib/chromium/chrome"]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

describe("prospectus MARC risk rating V3 visual contract", () => {
  const page1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
  const page2 = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
  const scale = buildProspectusMarcRatingScaleSectionHtml();
  const page4 = buildProspectusPageFourHtml();
  const presentation = resolveMarcNoteRiskPresentation("SME-3");

  it("Page 1 reuses V3 badge geometry and centred auto-margins", () => {
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("--prospectus-risk-shield-size:130px");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("--prospectus-risk-shield-height:42px");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("--prospectus-risk-shield-grade-font-size:27px");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("margin:16px auto 14px");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain("border-radius:9px");
    expect(PROSPECTUS_DOCUMENT_CSS).not.toContain('.risk-shield[data-grade^="SME-"]');
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(
      ".risk-panel strong{display:block;text-align:center;font-size:12px}"
    );
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(
      /\.risk-panel p[\s\S]*font-size:9px[\s\S]*margin:10px 0/
    );
    expect(page1).toContain(`data-grade="${presentation.grade}"`);
    expect(page1).toContain("Low Risk");
    expect(page1).toContain(presentation.riskProfile);
    expect(page1).toContain("See rating scale on page 2");
    expect(page1).toContain('class="scale-link"');
    expect(page1).not.toContain('href="#risk-scale"');
    expect(page1).not.toContain('data-grade="A"');
    expect(page1).not.toContain('data-grade="C"');
    expect(page1).not.toContain("Lower Risk");
    expect(page1).not.toContain("typical SME and transaction-level risks");
    expect(page1).not.toContain("This rating indicates level of credit risk");
  });

  it("Page 2 reuses V3 grouped scale CSS and copy", () => {
    expect(scale.match(/class="grade marc /g)?.length).toBe(5);
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".risk-scale{display:grid;grid-template-columns:repeat(5,1fr)");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".grade.marc.a{background:#69ca48}");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".grade.marc.b{background:#8ed657}");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".grade.marc.c{background:#f5ca47}");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".grade.marc.d{background:#f5964f}");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".grade.marc.e{background:#ef776c}");
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/\.grade\.marc\{[\s\S]*min-width:61px/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/\.grade\.marc\{[\s\S]*height:28px/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/\.grade\.marc\{[\s\S]*padding:0 5px/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/\.grade\.marc\{[\s\S]*border-radius:5px/);
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(/\.grade\.marc\{[\s\S]*font-size:7px/);
    expect(page2).toContain(PROSPECTUS_RISK_SCALE_NOTE);
    expect(page2).not.toContain('class="soukscore-scale');
    expect(page2).not.toContain("ellipsis");
    for (const band of MARC_SME_BANDS) {
      expect(page2).toContain(band.rangeLabel);
      expect(page2).toContain(band.label);
      expect(page2).toContain(band.groupedExplanation);
    }
    for (const grade of MARC_SME_GRADES) {
      expect(page2).not.toContain(`${grade}:`);
    }
    expect(page2).not.toContain(MARC_SCORE_DEFINITIONS["SME-1"].riskProfile);
  });

  it("Page 4 still uses official individual MARC definitions", () => {
    expect(page4).toContain("MARC SCORE DEFINITIONS");
    for (const grade of MARC_SME_GRADES) {
      expect(page4).toContain(grade);
      expect(page4).toContain(MARC_SCORE_DEFINITIONS[grade].riskProfile);
    }
  });

  it("keeps a five-page HTML document", () => {
    const combined = combineProspectusPagesHtml({
      page1,
      page2,
      page3: buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE),
      page4,
      page5: buildProspectusPageFiveHtml(),
    });
    expect(countProspectusHtmlPages(combined)).toBe(5);
  });
});

describe("prospectus MARC risk rating A4 Playwright layout", () => {
  it(
    "centres the Page 1 badge and fits the Page 2 scale at A4 width",
    async () => {
      const page1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
      const page2 = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
      const page3 = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
      const combined = combineProspectusPagesHtml({
        page1,
        page2,
        page3,
        page4: buildProspectusPageFourHtml(),
        page5: buildProspectusPageFiveHtml(),
      });
      const locked = combined.replace(
        /<\/head>/i,
        `<style data-admin-preview-scroll-lock>${ADMIN_PREVIEW_SCROLL_LOCK}</style></head>`
      );

      const executablePath = resolveChromiumExecutablePath();
      const browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      });

      const outDir = join(process.cwd(), "../../tmp/prospectus-marc-risk-v3");
      mkdirSync(outDir, { recursive: true });

      try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
        await page.setContent(locked, { waitUntil: "load", timeout: 120_000 });

        const metrics = await page.evaluate(() => {
          const p1 = document.querySelector(".prospectus-page-one") as HTMLElement | null;
          const p2 = document.querySelector(".prospectus-page-two") as HTMLElement | null;
          const panel = document.querySelector(".risk-panel") as HTMLElement | null;
          const badge = document.querySelector(".risk-shield") as HTMLElement | null;
          const grade = document.querySelector(".risk-shield-grade") as HTMLElement | null;
          const label = panel?.querySelector("strong") as HTMLElement | null;
          const description = panel?.querySelector(
            ".prospectus-risk-description"
          ) as HTMLElement | null;
          const cta = panel?.querySelector(".scale-link") as HTMLElement | null;
          const scale = document.querySelector(".risk-scale.marc-scale") as HTMLElement | null;
          const pills = [...document.querySelectorAll(".risk-scale.marc-scale .grade.marc")] as HTMLElement[];
          const columns = [...document.querySelectorAll(".risk-scale.marc-scale > div")] as HTMLElement[];
          const note = document.querySelector(".risk-scale-note") as HTMLElement | null;

          const pageOverflow = (el: HTMLElement | null) => {
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            let maxRight = 0;
            let maxBottom = 0;
            for (const child of [...el.querySelectorAll("*")] as HTMLElement[]) {
              const childRect = child.getBoundingClientRect();
              maxRight = Math.max(maxRight, childRect.right);
              maxBottom = Math.max(maxBottom, childRect.bottom);
            }
            return {
              width: rect.width,
              height: rect.height,
              overflowX: maxRight - rect.right,
              overflowY: maxBottom - rect.bottom,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
            };
          };

          const panelRect = panel?.getBoundingClientRect();
          const badgeRect = badge?.getBoundingClientRect();
          const labelRect = label?.getBoundingClientRect();
          const descRect = description?.getBoundingClientRect();
          const ctaRect = cta?.getBoundingClientRect();
          const badgeCs = badge ? getComputedStyle(badge) : null;
          const gradeCs = grade ? getComputedStyle(grade) : null;
          const labelCs = label ? getComputedStyle(label) : null;
          const descCs = description ? getComputedStyle(description) : null;
          const pillCs = pills[0] ? getComputedStyle(pills[0]) : null;
          const columnWidths = columns.map((col) => col.getBoundingClientRect().width);
          const pillMetrics = pills.map((pill) => {
            const cs = getComputedStyle(pill);
            return {
              text: pill.textContent?.trim() ?? "",
              width: pill.getBoundingClientRect().width,
              height: pill.getBoundingClientRect().height,
              fontSize: cs.fontSize,
              whiteSpace: cs.whiteSpace,
              overflow: cs.overflow,
              textOverflow: cs.textOverflow,
              scrollWidth: pill.scrollWidth,
              clientWidth: pill.clientWidth,
            };
          });

          return {
            page1: pageOverflow(p1),
            page2: pageOverflow(p2),
            badge: badgeRect
              ? {
                  width: badgeRect.width,
                  height: badgeRect.height,
                  marginLeft: badgeCs?.marginLeft ?? null,
                  marginRight: badgeCs?.marginRight ?? null,
                  leftGap: panelRect ? badgeRect.left - panelRect.left : null,
                  rightGap: panelRect ? panelRect.right - badgeRect.right : null,
                  fontSize: gradeCs?.fontSize ?? null,
                  borderRadius: badgeCs?.borderRadius ?? null,
                }
              : null,
            label: labelRect
              ? {
                  textAlign: labelCs?.textAlign ?? null,
                  fontSize: labelCs?.fontSize ?? null,
                  centerOffset:
                    panelRect && labelRect
                      ? Math.abs(
                          (labelRect.left + labelRect.width / 2) -
                            (panelRect.left + panelRect.width / 2)
                        )
                      : null,
                }
              : null,
            description: descRect
              ? {
                  fontSize: descCs?.fontSize ?? null,
                  textAlign: descCs?.textAlign ?? null,
                  width: descRect.width,
                  centerOffset:
                    panelRect && descRect
                      ? Math.abs(
                          (descRect.left + descRect.width / 2) -
                            (panelRect.left + panelRect.width / 2)
                        )
                      : null,
                }
              : null,
            cta: ctaRect
              ? {
                  top: ctaRect.top,
                  left: ctaRect.left,
                  visible: ctaRect.width > 0 && ctaRect.height > 0,
                }
              : null,
            scale: {
              columnCount: columns.length,
              columnWidths,
              pillCount: pills.length,
              pillMetrics,
              pillHeight: pillCs?.height ?? null,
              pillFontSize: pillCs?.fontSize ?? null,
              pillRadius: pillCs?.borderRadius ?? null,
              noteVisible: note
                ? note.getBoundingClientRect().bottom <= (p2?.getBoundingClientRect().bottom ?? 0) + 1
                : false,
            },
          };
        });

        await page.locator(".prospectus-page-one .risk-panel").screenshot({
          path: join(outDir, "page1-risk-panel.png"),
        });
        await page.locator(".prospectus-page-two .risk-cta > .card").screenshot({
          path: join(outDir, "page2-risk-scale.png"),
        });
        await page.locator(".prospectus-page-one").screenshot({
          path: join(outDir, "page1-full.png"),
        });
        await page.locator(".prospectus-page-two").screenshot({
          path: join(outDir, "page2-full.png"),
        });

        expect(metrics.badge).not.toBeNull();
        expect(metrics.badge?.width).toBeGreaterThanOrEqual(128);
        expect(metrics.badge?.width).toBeLessThanOrEqual(132);
        expect(metrics.badge?.height).toBeGreaterThanOrEqual(40);
        expect(metrics.badge?.height).toBeLessThanOrEqual(44);
        expect(metrics.badge?.fontSize).toBe("27px");
        expect(metrics.badge?.borderRadius).toBe("9px");
        expect(metrics.badge?.leftGap ?? 0).toBeGreaterThan(8);
        expect(Math.abs((metrics.badge?.leftGap ?? 0) - (metrics.badge?.rightGap ?? 0))).toBeLessThan(2);

        expect(metrics.label?.fontSize).toBe("12px");
        expect(metrics.label?.textAlign).toBe("center");
        expect(metrics.label?.centerOffset ?? 99).toBeLessThan(4);

        expect(metrics.description?.fontSize).toBe("9px");
        expect(metrics.description?.textAlign).toBe("left");
        expect(metrics.description?.centerOffset ?? 99).toBeLessThan(4);
        expect(metrics.cta?.visible).toBe(true);

        expect(metrics.scale.columnCount).toBe(5);
        expect(metrics.scale.pillCount).toBe(5);
        const colMin = Math.min(...metrics.scale.columnWidths);
        const colMax = Math.max(...metrics.scale.columnWidths);
        expect(colMax - colMin).toBeLessThan(2);
        expect(metrics.scale.pillHeight).toBe("28px");
        expect(metrics.scale.pillFontSize).toBe("7px");
        expect(metrics.scale.pillRadius).toBe("5px");
        for (const pill of metrics.scale.pillMetrics) {
          expect(pill.whiteSpace).toBe("nowrap");
          expect(pill.textOverflow).not.toBe("ellipsis");
          expect(pill.scrollWidth).toBeLessThanOrEqual(pill.clientWidth + 1);
          expect(pill.text).toMatch(/^SME-\d+ - SME-\d+$/);
        }
        expect(metrics.scale.noteVisible).toBe(true);

        expect(metrics.page1?.overflowX ?? 99).toBeLessThan(1);
        expect(metrics.page2?.overflowX ?? 99).toBeLessThan(1);
        expect(metrics.page1?.overflowY ?? 99).toBeLessThan(8);
        expect(metrics.page2?.overflowY ?? 99).toBeLessThan(8);
        expect((metrics.page1?.scrollWidth ?? 99) - (metrics.page1?.clientWidth ?? 0)).toBeLessThan(2);
        expect((metrics.page2?.scrollWidth ?? 99) - (metrics.page2?.clientWidth ?? 0)).toBeLessThan(2);

        await page.close();
      } finally {
        await browser.close();
      }
    },
    120_000
  );
});
