/**
 * SECTION: Shared investor Prospectus document CSS
 * WHY: Fixed A4 pages for screen + print; preview chrome only; no mobile reflow
 */

import { PROSPECTUS_SHARIAH_BADGE_DISPLAY_SIZE_PX } from "./prospectus-shariah-badge";
import { PROSPECTUS_RISK_SHIELD_GRADE_FONT_SIZE_PX } from "./prospectus-risk-shield";

/** Fixed A4 geometry — never shrink with viewport. */
export const PROSPECTUS_A4_WIDTH_MM = 210;
export const PROSPECTUS_A4_HEIGHT_MM = 297;

/**
 * Shared outer page canvas padding for Pages 1–3 (top / horizontal / bottom).
 * Top is slightly tighter so space can sit inside the header above the red divider.
 * Do not override per-page unless a temporary fit emergency is approved.
 */
export const PROSPECTUS_PAGE_PADDING_TOP_PX = 20;
export const PROSPECTUS_PAGE_PADDING_X_PX = 28;
export const PROSPECTUS_PAGE_PADDING_BOTTOM_PX = 24;
export const PROSPECTUS_PAGE_PADDING_CSS = `${PROSPECTUS_PAGE_PADDING_TOP_PX}px ${PROSPECTUS_PAGE_PADDING_X_PX}px ${PROSPECTUS_PAGE_PADDING_BOTTOM_PX}px`;

/**
 * Logo SVG (`apps/investor/public/logo.svg`) is viewBox `0 0 1440 540` with large
 * transparent padding. Crop to visible artwork so display width maps to brand mark + wordmark.
 */
export const PROSPECTUS_LOGO_SVG_VIEWBOX = "40 145 1340 255";
/** Display size after crop (~5.25:1). Target ~260–280px wide visible branding. */
export const PROSPECTUS_LOGO_DISPLAY_WIDTH_PX = 270;
export const PROSPECTUS_LOGO_DISPLAY_HEIGHT_PX = 52;
/** @deprecated Prefer PROSPECTUS_LOGO_DISPLAY_HEIGHT_PX */
export const PROSPECTUS_LOGO_HEIGHT_PX = PROSPECTUS_LOGO_DISPLAY_HEIGHT_PX;
/** @deprecated Prefer PROSPECTUS_LOGO_DISPLAY_WIDTH_PX */
export const PROSPECTUS_LOGO_MAX_WIDTH_PX = PROSPECTUS_LOGO_DISPLAY_WIDTH_PX;

/**
 * Shared header sizing — identical on Pages 1–3.
 * Extra bottom padding creates breathing room between the logo row and the red divider.
 */
export const PROSPECTUS_HEADER_HEIGHT_PX = 64;
/** Space inside the header between content and the red border-bottom divider. */
export const PROSPECTUS_HEADER_PADDING_BOTTOM_PX = 10;
/**
 * Gap between red header divider and first page content (shared Pages 1–3).
 * Keep intentional — content must not sit against the divider.
 */
export const PROSPECTUS_HEADER_CONTENT_GAP_PX = 12;
/** Shared supporting copy (header tagline + footer disclaimer). */
export const PROSPECTUS_SUPPORTING_FONT_SIZE_PX = 9.5;
export const PROSPECTUS_SUPPORTING_LINE_HEIGHT = 1.3;
export const PROSPECTUS_SUPPORTING_TEXT_COLOR = "#4a4a4a";
/** @deprecated Prefer PROSPECTUS_SUPPORTING_FONT_SIZE_PX */
export const PROSPECTUS_TAGLINE_FONT_SIZE_PX = PROSPECTUS_SUPPORTING_FONT_SIZE_PX;
/** Horizontal gap between logo and tagline (tighter, Canva-aligned). */
export const PROSPECTUS_BRAND_GAP_PX = 8;
/** Nudge tagline up from absolute flex-end so it sits on the wordmark baseline. */
export const PROSPECTUS_TAGLINE_BASELINE_OFFSET_PX = 6;
/** Compact Shariah icon inside the bordered pill badge. */
export const PROSPECTUS_SHARIAH_BADGE_SIZE_PX = PROSPECTUS_SHARIAH_BADGE_DISPLAY_SIZE_PX;

/** Shared section heading (card/section h2) — identical scale on Pages 1–3. */
export const PROSPECTUS_SECTION_TITLE_FONT_SIZE_PX = 12;
export const PROSPECTUS_SECTION_TITLE_MARGIN_BOTTOM_PX = 10;

/** Shared Page 3 page-title block (and any future page-level titles). */
export const PROSPECTUS_PAGE_TITLE_FONT_SIZE_PX = 22;
export const PROSPECTUS_PAGE_TITLE_PADDING_CSS = "20px 0 14px";
export const PROSPECTUS_PAGE_TITLE_MARGIN_BOTTOM_PX = 8;
export const PROSPECTUS_PAGE_SUBTITLE_FONT_SIZE_PX = 9;

/** Shared radius / border. */
export const PROSPECTUS_RADIUS_CARD_PX = 8;
export const PROSPECTUS_BORDER_WIDTH_PX = 1;

/**
 * Screen + print stylesheet for investor Prospectus HTML.
 * - `.page` is always 210mm × 297mm (min and exact).
 * - Grey canvas / shadow / outer padding are preview-only.
 * - No max-width media queries that stack grids or reflow sections.
 */
export const PROSPECTUS_DOCUMENT_CSS = `
:root{
  /* Colour tokens — Pages 1–3 */
  --prospectus-burgundy:#a51d21;
  --prospectus-page-title-color:#a8181d;
  --prospectus-table-red:#df2b23;
  --prospectus-header-divider:#bd2c2c;
  --prospectus-icon-bg:#efcecf;
  --prospectus-icon-stroke:#b22a30;
  --prospectus-border:#bdb9b9;
  --prospectus-border-soft:#c2bebe;
  --prospectus-divider:#c9c5c5;
  --prospectus-text:#171717;
  --prospectus-muted:#5c5c5c;
  --prospectus-supporting-font-size:${PROSPECTUS_SUPPORTING_FONT_SIZE_PX}px;
  --prospectus-supporting-line-height:${PROSPECTUS_SUPPORTING_LINE_HEIGHT};
  --prospectus-supporting-text:${PROSPECTUS_SUPPORTING_TEXT_COLOR};
  --prospectus-positive:#22b83f;
  --prospectus-positive-green:var(--prospectus-positive);
  --prospectus-cta-bg:#f7eaea;
  --prospectus-cta-button:#a60000;
  --prospectus-soft:#f8eded;
  --prospectus-table-plain-bg:#f2f0f0;
  /* Legacy aliases used by existing selectors */
  --red:#b10810;--bright:#dc2a22;--pink:#edd1d1;--soft:var(--prospectus-soft);--line:var(--prospectus-divider);
  --ink:var(--prospectus-text);--muted:var(--prospectus-muted);--green:var(--prospectus-positive);--light-green:#dcefc8;
  /* Geometry */
  --prospectus-a4-width:${PROSPECTUS_A4_WIDTH_MM}mm;
  --prospectus-a4-height:${PROSPECTUS_A4_HEIGHT_MM}mm;
  --prospectus-page-padding-top:${PROSPECTUS_PAGE_PADDING_TOP_PX}px;
  --prospectus-page-padding-x:${PROSPECTUS_PAGE_PADDING_X_PX}px;
  --prospectus-page-padding-bottom:${PROSPECTUS_PAGE_PADDING_BOTTOM_PX}px;
  --prospectus-page-padding:var(--prospectus-page-padding-top) var(--prospectus-page-padding-x) var(--prospectus-page-padding-bottom);
  --prospectus-header-height:${PROSPECTUS_HEADER_HEIGHT_PX}px;
  --prospectus-header-padding-bottom:${PROSPECTUS_HEADER_PADDING_BOTTOM_PX}px;
  --prospectus-header-content-gap:${PROSPECTUS_HEADER_CONTENT_GAP_PX}px;
  --prospectus-logo-width:${PROSPECTUS_LOGO_DISPLAY_WIDTH_PX}px;
  --prospectus-logo-height:${PROSPECTUS_LOGO_DISPLAY_HEIGHT_PX}px;
  --prospectus-tagline-font-size:var(--prospectus-supporting-font-size);
  --prospectus-brand-gap:${PROSPECTUS_BRAND_GAP_PX}px;
  --prospectus-tagline-baseline-offset:${PROSPECTUS_TAGLINE_BASELINE_OFFSET_PX}px;
  --prospectus-footer-icon-gap:6px;
  --prospectus-shariah-badge-size:${PROSPECTUS_SHARIAH_BADGE_SIZE_PX}px;
  --prospectus-risk-shield-size:72px;
  --prospectus-risk-shield-grade-font-size:${PROSPECTUS_RISK_SHIELD_GRADE_FONT_SIZE_PX}px;
  --prospectus-section-title-font-size:${PROSPECTUS_SECTION_TITLE_FONT_SIZE_PX}px;
  --prospectus-section-title-margin-bottom:${PROSPECTUS_SECTION_TITLE_MARGIN_BOTTOM_PX}px;
  --prospectus-page-title-font-size:${PROSPECTUS_PAGE_TITLE_FONT_SIZE_PX}px;
  --prospectus-page-title-padding:${PROSPECTUS_PAGE_TITLE_PADDING_CSS};
  --prospectus-page-title-margin-bottom:${PROSPECTUS_PAGE_TITLE_MARGIN_BOTTOM_PX}px;
  --prospectus-page-subtitle-font-size:${PROSPECTUS_PAGE_SUBTITLE_FONT_SIZE_PX}px;
  --prospectus-radius-card:${PROSPECTUS_RADIUS_CARD_PX}px;
  --prospectus-border-width:${PROSPECTUS_BORDER_WIDTH_PX}px;
  /* Spacing scale */
  --space-1:4px;--space-2:6px;--space-3:8px;--space-4:10px;--space-5:14px;--space-6:18px;
  /* Icon system — Heroicons 24/outline */
  --prospectus-icon-stroke-width:1.5;
  --prospectus-icon-color:var(--prospectus-icon-stroke);
  --prospectus-icon-background:var(--prospectus-icon-bg);
  --prospectus-icon-large-circle:58px;
  --prospectus-icon-large-size:30px;
  --prospectus-icon-field-circle:30px;
  --prospectus-icon-field-size:17px;
  --prospectus-icon-stat-circle:34px;
  --prospectus-icon-stat-size:18px;
  --prospectus-icon-meta-circle:30px;
  --prospectus-icon-meta-size:16px;
  --prospectus-icon-takeaway-circle:34px;
  --prospectus-icon-takeaway-size:18px;
  /* Legacy aliases used by existing selectors */
  --prospectus-icon-field:var(--prospectus-icon-field-circle);
  --prospectus-icon-stat:var(--prospectus-icon-stat-circle);
  --prospectus-icon-meta:var(--prospectus-icon-meta-circle);
  --prospectus-icon-takeaway:var(--prospectus-icon-takeaway-circle);
  --prospectus-icon-work:25px;
}
*,*::before,*::after{box-sizing:border-box}
html{
  background:#ececec; /* preview-only grey canvas */
  width:100%;
  min-width:0;
  max-width:none;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
body{
  margin:0;
  width:100%;
  min-width:0;
  max-width:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;
  color:var(--ink);
  font-size:10px;
  line-height:1.35;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
  overflow-x:auto; /* Open in New Tab: scroll when viewport < A4; Admin iframe locks this */
}
/* Stack/centre pages — do not force 210mm on the document shell (avoids 210mm + padding overflow) */
.document{
  width:100%;
  min-width:0;
  max-width:none;
  margin:0 auto;
  padding:24px 0; /* preview-only vertical gap above/below pages; no horizontal padding */
}
/* Only .page owns the fixed A4 width */
.page{
  width:var(--prospectus-a4-width);
  height:var(--prospectus-a4-height);
  min-width:var(--prospectus-a4-width);
  min-height:var(--prospectus-a4-height);
  max-width:var(--prospectus-a4-width);
  max-height:var(--prospectus-a4-height);
  margin:0 auto 26px;
  background:#fff; /* page surface stays white */
  padding:var(--prospectus-page-padding); /* shared Pages 1–3 canvas padding */
  position:relative;
  box-shadow:0 4px 24px #0002; /* preview-only */
  display:flex;
  flex-direction:column;
  overflow:hidden;
  /* page-break / break-after are print-only — on screen they overlap stacked A4 pages in Chromium */
}
.page:last-child{
  margin-bottom:0;
}
.page-header{height:var(--prospectus-header-height);padding-bottom:var(--prospectus-header-padding-bottom);border-bottom:2px solid var(--prospectus-header-divider);display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--prospectus-header-content-gap);flex:none}
.brand,.prospectus-brand{display:flex;align-items:flex-end;gap:var(--prospectus-brand-gap);position:relative;min-width:0}
.brand-logo{width:var(--prospectus-logo-width);height:var(--prospectus-logo-height);object-fit:contain;object-position:left center;flex:none;display:block}
.brand-mark-placeholder{width:48px;height:var(--prospectus-logo-height);border:2px solid var(--red);background:var(--red);border-radius:3px;flex:none}
.tagline,.prospectus-tagline{font-size:var(--prospectus-supporting-font-size);margin:0 0 var(--prospectus-tagline-baseline-offset);color:var(--prospectus-supporting-text);line-height:var(--prospectus-supporting-line-height);white-space:nowrap}
/* Bordered pill: small SVG mark + label — shared Pages 1–3 */
.shariah{display:flex;align-items:center;gap:6px;flex:none;min-width:0;border:1.5px solid var(--red);border-radius:7px;padding:5px 10px}
.shariah-badge{width:var(--prospectus-shariah-badge-size);height:var(--prospectus-shariah-badge-size);object-fit:contain;flex:none;display:block}
.shariah-label{font-size:8px;font-weight:400;color:#000000;line-height:1.2;white-space:nowrap}
h1,h2,p{margin-top:0}
/* Shared section titles (Pages 1–3) — do not shrink per page */
h2{
  font-size:var(--prospectus-section-title-font-size);
  font-weight:700;
  line-height:1.25;
  letter-spacing:0;
  text-transform:uppercase;
  color:var(--prospectus-burgundy);
  margin-bottom:var(--prospectus-section-title-margin-bottom);
}
.hero-grid{display:grid;grid-template-columns:1.35fr 1fr .82fr;border-bottom:1px solid var(--line);min-height:210px}
.hero-grid>div{padding:18px 14px}.hero-grid>div+div{border-left:1px solid var(--line)}
.eyebrow{text-transform:uppercase;font-weight:800;color:var(--prospectus-burgundy);font-size:var(--prospectus-section-title-font-size);line-height:1.25;margin-bottom:6px}
.hero-copy h1{font-size:32px;letter-spacing:-1.2px;margin:0 0 4px}.product-pill{display:inline-block;background:#e7bbbb;color:#a32424;font-weight:800;text-transform:uppercase;border-radius:4px;padding:6px 8px;margin-bottom:14px}
.hero-copy p{font-size:11px;max-width:280px;margin:0}
.meta-row{display:flex;gap:12px;margin-bottom:18px;align-items:flex-start}.meta-row .icon{width:22px;height:22px;color:var(--prospectus-icon-color);flex:none;stroke-width:var(--prospectus-icon-stroke-width)}.meta-row b,.meta-row span{display:block}.meta-row b{font-size:10px}.meta-row span{font-size:9px;margin-top:2px}
/* Four timeline rows in the middle hero column — slightly tighter than generic meta-row */
.key-dates .meta-row{margin-bottom:12px}.key-dates .meta-row:last-child{margin-bottom:0}
.risk-panel{text-align:left}.risk-panel>b{font-size:10px}
.risk-shield{position:relative;width:var(--prospectus-risk-shield-size);height:var(--prospectus-risk-shield-size);margin:8px auto 2px;display:grid;place-items:center}
.risk-shield-asset{width:100%;height:100%;object-fit:contain;display:block}
/* Grade letter size from Canva reference (.shield font-size:30px); centred via absolute inset + grid */
.risk-shield-grade{position:absolute;inset:0;display:grid;place-items:center;font-size:var(--prospectus-risk-shield-grade-font-size);font-weight:800;line-height:1;pointer-events:none;color:#fff}
.risk-shield-fallback{border-radius:8px}
/* Risk label under shield — restore origin/main / Canva size (not the enlarged 14px treatment) */
.risk-panel strong{display:block;text-align:center;font-size:12px}
.risk-panel .prospectus-risk-description,.prospectus-risk-description{font-size:10px;line-height:1.35;font-weight:400;margin:8px 0 10px;color:var(--prospectus-text)}
.risk-panel .scale-link{font-size:8px;font-weight:800;color:var(--prospectus-burgundy);text-decoration:none;cursor:default}
.card{border:var(--prospectus-border-width) solid var(--prospectus-border);border-radius:var(--prospectus-radius-card);overflow:hidden}
/* Vertically stacked compound sections — one outer silhouette, no mid-seam radius */
.connected-card-top{
  border-radius:var(--prospectus-radius-card) var(--prospectus-radius-card) 0 0;
  border-bottom:0;
  margin-bottom:0;
}
.hero-grid + .connected-card-top{margin-top:var(--space-3)}
.connected-card-middle{
  border-radius:0;
  border-bottom:0;
  margin-top:0;
  margin-bottom:0;
}
.connected-card-bottom{
  border-radius:0 0 var(--prospectus-radius-card) var(--prospectus-radius-card);
  margin-top:0;
}
.split-card{display:grid;grid-template-columns:1fr 1.05fr;margin-top:var(--space-3)}.split-card.connected-card-top,.split-card.connected-card-middle,.split-card.connected-card-bottom{margin-top:0}.split-card>div{padding:15px}.split-card>div+div{border-left:1px solid var(--line)}
.summary-list{margin:0}.summary-list div{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d4d1d1;padding:5px 0}.summary-list div:last-child{border-bottom:0}
.summary-list dt{font-weight:700;padding-left:28px;position:relative}.summary-list dt:before{content:"";width:18px;height:18px;background:#e3bfc0;border-radius:3px;position:absolute;left:0;top:-2px}.summary-list dd{margin:0;text-align:right}
.tick-item{display:flex;gap:10px;margin-bottom:13px;align-items:flex-start}
.investor-highlight-check{width:22px;height:22px;border-radius:999px;background:var(--prospectus-positive-green);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
.investor-highlight-check svg,.investor-highlight-check .icon{width:15px;height:15px;color:#fff;stroke-width:2.2;display:block}
.tick-item p{font-size:9px;margin:0}.tick-item b{display:block;font-size:10px;margin-bottom:3px}
.strip{border:var(--prospectus-border-width) solid var(--prospectus-border);padding:15px 15px 10px}.strip h2,.track h2{margin-bottom:var(--prospectus-section-title-margin-bottom)}
.stats{display:grid;gap:var(--space-3)}.stats.five{grid-template-columns:repeat(5,1fr)}.stats.four{grid-template-columns:repeat(4,1fr)}
.stat{display:grid;grid-template-columns:var(--prospectus-icon-stat) 1fr;grid-template-rows:auto auto;column-gap:7px;align-items:center}.stat .icon{grid-row:1/3;background:var(--prospectus-icon-bg);color:var(--prospectus-icon-stroke);border-radius:50%;padding:7px;width:var(--prospectus-icon-stat);height:var(--prospectus-icon-stat);box-sizing:border-box}.stat small{font-size:7px}.stat b{font-size:11px}
.track{border:var(--prospectus-border-width) solid var(--prospectus-border);padding:15px}.track .stats{margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:8px}th{background:var(--prospectus-table-red);color:#fff;padding:7px 5px;font-weight:600}td{border:1px solid #e1dddd;padding:5px;text-align:center}td:first-child,th:first-child{text-align:left}
.table-wrap{overflow-x:auto}.track em,.financial-card em,.card em,.source{display:block;font-size:7px;margin-top:8px;font-style:italic}
/* Shared disclaimer footer — pinned to A4 bottom; content source lines stay with their sections */
.prospectus-footer,footer.prospectus-footer{margin-top:auto;display:flex;align-items:flex-start;gap:var(--prospectus-footer-icon-gap);padding-top:10px;flex-shrink:0}
.prospectus-footer .icon{color:#b3131b;width:22px;height:22px;flex:none;margin-top:1px}
.prospectus-footer-copy{font-size:var(--prospectus-supporting-font-size);line-height:var(--prospectus-supporting-line-height);color:var(--prospectus-supporting-text)}
.financial-source{display:block;margin-top:var(--space-3);margin-left:12px;font-size:7px;font-style:italic}
/* Page 2 top: plain two columns + vertical divider only (not a card) */
.issuer-grid{display:grid;grid-template-columns:.9fr 1.1fr;margin-bottom:var(--space-3)}.issuer-grid>section{padding:20px 14px}.issuer-grid>section+section{border-left:1px solid var(--line)}
.page-two-issuer-grid{
  height:auto;
  min-height:0;
  overflow:visible;
  align-items:start;
  flex-shrink:0;
  margin-bottom:8px; /* gap before financial compound card */
}
.issuer-profile{display:flex;gap:18px;align-items:center;margin:20px 0}.round-icon,.prospectus-issuer-icon-circle{width:var(--prospectus-icon-large-circle);height:var(--prospectus-icon-large-circle);border-radius:999px;background:var(--prospectus-icon-background);display:grid;place-items:center;color:var(--prospectus-icon-color)}.round-icon .icon,.prospectus-issuer-icon{width:var(--prospectus-icon-large-size);height:var(--prospectus-icon-large-size);stroke-width:var(--prospectus-icon-stroke-width)}.issuer-profile span,.issuer-profile b{display:block;margin-bottom:8px}.issuer-grid p{font-size:9px;margin:0;line-height:1.35}
.invoice-info dl{margin:0}.invoice-info dl div{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:13px}.invoice-info dt{display:flex;align-items:center;gap:10px;font-weight:700;min-width:0}.invoice-info dt .icon,.work-list .icon{width:var(--prospectus-icon-field);height:var(--prospectus-icon-field);padding:6px;background:var(--prospectus-icon-bg);border-radius:50%;color:var(--prospectus-icon-stroke);box-sizing:border-box;flex:none}.invoice-info dd{margin:0;text-align:right;max-width:52%;line-height:1.25;overflow-wrap:anywhere;word-break:break-word}
.page-two-invoice-list{display:flex;flex-direction:column;row-gap:5px;margin:0}
.page-two-invoice-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;min-height:0;margin:0;padding-block:1px}
.page-two-invoice-row dt{display:flex;align-items:center;gap:8px;font-weight:700;min-width:0}
.page-two-invoice-row dd{margin:0;text-align:right;max-width:52%;line-height:1.25;overflow-wrap:anywhere;word-break:break-word}
.page-two-invoice-icon{width:26px;height:26px;padding:4px;background:var(--prospectus-icon-bg);border-radius:50%;color:var(--prospectus-icon-stroke);box-sizing:border-box;flex:none}
.financial-card{display:grid;grid-template-columns:.34fr .66fr}.financial-card>div{padding:12px}.financial-card>div+div{border-left:1px solid var(--line)}.summary-list.compact dt{padding-left:0}.summary-list.compact dt:before{display:none}.plain th{background:var(--prospectus-table-plain-bg);color:#111}.plain td,.plain th{text-align:center}.plain td:first-child,.plain th:first-child{text-align:left}
/* Page 2 Paymaster + Financial Comparison: grow to tallest column.
   Root cause: .page is flex column + .card{overflow:hidden} lets the card flex-shrink
   below the taller financial table, clipping Receivables Days. */
.page-two-financial-card{
  height:auto;
  min-height:0;
  overflow:visible;
  align-items:stretch;
  flex-shrink:0;
}
/* Page 2 Credit Insights + Work Performed: same flex-shrink clip as financial card */
.page-two-insights-card{
  height:auto;
  min-height:0;
  overflow:visible;
  align-items:stretch;
  flex-shrink:0;
}
.page-two-risk-cta{flex-shrink:0}
.credit-insights-note{display:block;font-size:7px;margin-top:8px;font-style:italic;line-height:1.3;color:var(--prospectus-muted)}
.ratings div{display:grid;grid-template-columns:1fr 110px;gap:8px;align-items:center;margin:5px 0;position:relative}.ratings div:before{content:"";width:17px;height:17px;background:#e3bfc0;border-radius:3px;position:absolute;left:0}.ratings span{font-weight:700;padding-left:22px}.ratings b{background:#d8d8d8;text-align:center;padding:5px;border-radius:4px;font-weight:500}.ratings .good{color:#21a43b}
.work-list p{display:flex;align-items:flex-start;gap:10px;font-size:9px;margin-bottom:9px}.work-list .icon{flex:none;width:var(--prospectus-icon-work);height:var(--prospectus-icon-work);padding:4px;box-sizing:border-box}
.risk-cta{display:grid;grid-template-columns:2fr 1fr;gap:9px;margin-top:var(--space-3);align-items:stretch}.risk-cta>.card,.risk-cta>.cta{padding:10px;min-height:100%}

/* Page 2 only — recover A4 height from the top issuer/invoice block (header gap unchanged) */
.prospectus-page-two .page-two-issuer-grid{margin-top:0}
.prospectus-page-two .page-two-issuer-grid>section{padding:5px 12px 3px}
.prospectus-page-two .page-two-issuer-grid>section h2{margin-bottom:5px}
.prospectus-page-two .issuer-profile{margin:4px 0;gap:10px}
.prospectus-page-two .issuer-profile span,.prospectus-page-two .issuer-profile b{margin-bottom:2px}
.prospectus-page-two .issuer-meta-line{margin-bottom:2px}
.prospectus-page-two .round-icon,.prospectus-page-two .prospectus-issuer-icon-circle{width:var(--prospectus-icon-large-circle);height:var(--prospectus-icon-large-circle)}
.prospectus-page-two .round-icon .icon,.prospectus-page-two .prospectus-issuer-icon{width:var(--prospectus-icon-large-size);height:var(--prospectus-icon-large-size)}
.prospectus-page-two .issuer-grid p{line-height:1.25}
.prospectus-page-two .invoice-info h2{margin-bottom:5px}
.prospectus-page-two .page-two-invoice-list .page-two-invoice-row,
.prospectus-page-two .invoice-info .page-two-invoice-row{margin-bottom:0;padding-block:0}
.prospectus-page-two .page-two-invoice-row .icon,
.prospectus-page-two .page-two-invoice-icon{width:24px;height:24px;padding:3px}
.prospectus-page-two .ratings div{margin:3px 0}
.prospectus-page-two .work-list p{margin-bottom:6px}
.prospectus-page-two .page-two-financial-card,.prospectus-page-two .page-two-insights-card{padding-top:0}
.prospectus-page-two .risk-cta{margin-top:5px}
.prospectus-page-two .invest-confidence-description{margin:0 0 6px;line-height:1.25}
.prospectus-page-two .soukscore-scale .grade-item{padding:4px 3px}
.prospectus-page-two .risk-scale-note{margin:4px 0 0;font-size:7px;line-height:1.2}
.prospectus-page-two .prospectus-footer{padding-top:8px}
.soukscore-scale,.risk-scale{display:grid;grid-template-columns:repeat(6,1fr);list-style:none;margin:0;padding:0;align-items:start}
.soukscore-scale .grade-item,.risk-scale>div{padding:6px 4px;border-right:1px solid #c9c5c5;text-align:center}.soukscore-scale .grade-item:last-child,.risk-scale>div:last-child{border:0}
.soukscore-scale .grade,.grade{width:33px;height:33px;color:#fff;border-radius:6px;display:grid;place-items:center;font-size:12px;margin:0 auto 4px;background:#79cf54;font-weight:800;box-sizing:border-box}
.soukscore-scale .grade-label{display:block;font-size:7px;font-weight:700;line-height:1.25;margin:0 0 3px}
.soukscore-scale .grade-desc{display:block;font-size:6px;line-height:1.3;color:#555;font-weight:400}
.soukscore-missing{margin:8px 0 0;font-size:8px}
.issuer-profile .issuer-meta-line{font-size:10px;font-weight:700;margin-bottom:6px}
.plain th .fy-label,.report-box th .fy-label{display:block;font-weight:700}
.plain th .fy-end,.report-box th .fy-end{display:block;font-size:7px;font-weight:400;margin-top:2px;color:#666}
.cta{border:var(--prospectus-border-width) solid var(--prospectus-border-soft);border-radius:var(--prospectus-radius-card);background:var(--prospectus-cta-bg);padding:11px}.cta p{font-size:9px}.cta-button{display:block;width:100%;border:0;border-radius:5px;background:var(--prospectus-cta-button);color:#fff;text-transform:uppercase;font-weight:800;padding:8px;font-size:11px;text-align:center;text-decoration:none;cursor:default;pointer-events:none;user-select:none}.cta-minimum{text-align:center;display:block;margin-top:7px;font-size:8px}
.risk-scale-note{margin:5px 0 0;font-size:7.5px;line-height:1.25;font-style:italic;color:var(--prospectus-muted)}
.invest-confidence-description{margin:0 0 8px;font-size:9px;line-height:1.3}
/* Shared page-level title block (Page 3 today; same tokens if reused elsewhere) */
.page-title{padding:var(--prospectus-page-title-padding)}
.page-title h1,.page-title h2{
  text-transform:uppercase;
  color:var(--prospectus-page-title-color);
  font-size:var(--prospectus-page-title-font-size);
  font-weight:700;
  line-height:1.2;
  letter-spacing:0;
  margin:0 0 var(--prospectus-page-title-margin-bottom);
}
.page-title p{font-size:var(--prospectus-page-subtitle-font-size);margin:0;line-height:1.35;color:var(--prospectus-text)}
.identity-strip,.meta-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin-bottom:var(--space-6)}.identity-strip>div,.meta-strip-item{display:flex;gap:9px;padding:12px 9px;border-right:1px solid #c8c4c4;align-items:flex-start}.identity-strip>div:last-child,.meta-strip-item:last-child{border-right:0}.identity-strip .icon,.meta-strip-item .icon{width:var(--prospectus-icon-meta);height:var(--prospectus-icon-meta);padding:7px;background:var(--prospectus-icon-bg);border-radius:50%;color:var(--prospectus-icon-stroke);flex:none;box-sizing:border-box}.meta-strip-label,.identity-strip small{font-weight:800;font-size:7px;display:block}.meta-strip-value,.identity-strip b{font-size:8px;margin-top:5px;display:block}
.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)}.report-box{padding:9px}.report-box h2{font-size:11px;color:var(--prospectus-burgundy)}.report-box table{font-size:7.5px}.report-box th{font-size:7px}.report-box td{height:24px}
.insight{background:var(--light-green);border-radius:7px;padding:9px;display:flex;align-items:center;gap:8px;margin-top:8px;font-size:8px}.insight .icon{width:30px;height:30px;background:#1dbb3d;color:#fff;border-radius:50%;padding:5px;box-sizing:border-box}
.prospectus-income-trend-insight{background:var(--light-green);border-radius:7px;padding:9px;display:flex;align-items:center;gap:8px;margin-top:8px;font-size:8px;color:var(--prospectus-text);line-height:1.35}
.prospectus-income-trend-insight .icon{width:30px;height:30px;background:#1dbb3d;color:#fff;border-radius:50%;padding:5px;box-sizing:border-box;flex:none}
.prospectus-income-trend-insight .insight-message{flex:1;min-width:0}
.trend-cell{text-align:center;vertical-align:middle;line-height:1}
.trend-cell .trend-icon{width:15px;height:15px;display:inline-block;vertical-align:middle}
.trend-cell.trend-favourable{color:var(--prospectus-positive)}
.trend-cell.trend-unfavourable{color:var(--prospectus-table-red)}
.trend-cell.trend-muted{color:var(--prospectus-muted)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.takeaways p,.takeaway-item{display:flex;gap:10px;align-items:center;font-size:8.5px;margin:0 0 12px}.takeaways .icon,.takeaway-item .icon{flex:none;width:var(--prospectus-icon-takeaway);height:var(--prospectus-icon-takeaway);background:var(--prospectus-icon-bg);color:var(--prospectus-icon-stroke);border-radius:50%;padding:7px;box-sizing:border-box}.source{margin-left:12px}

/* Page 3 — source stays with content; disclaimer alone uses margin-top:auto */
.prospectus-page-three .report-box th .fy-end{color:#fff;opacity:.92;font-size:7px}
.prospectus-page-three .takeaways{display:flex;flex-direction:column;min-height:100%}
.prospectus-page-three .takeaways-empty{display:flex;align-items:center;justify-content:center;flex:1;min-height:220px;margin:0;font-size:14px;color:var(--muted)}
.prospectus-page-three .comparison-grid{flex-shrink:0}
.prospectus-page-three>.financial-source{flex-shrink:0}

/* Print / PDF: A4 page nodes only — no preview chrome */
@media print{
  @page{size:A4;margin:0}
  html,body,.document{
    background:#fff !important;
    overflow:visible !important;
    width:auto !important;
    height:auto !important;
    display:block !important;
  }
  .document{
    padding:0 !important;
    min-width:0 !important;
  }
  .page{
    display:block !important;
    width:210mm !important;
    height:297mm !important;
    min-width:210mm !important;
    min-height:297mm !important;
    max-width:210mm !important;
    max-height:297mm !important;
    margin:0 !important;
    box-shadow:none !important;
    page-break-after:always !important;
    break-after:page !important;
    page-break-inside:avoid;
    break-inside:avoid;
    overflow:hidden !important;
  }
  .page:last-child{
    page-break-after:auto !important;
    break-after:auto !important;
  }
}
`.trim();
