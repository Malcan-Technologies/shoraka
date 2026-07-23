/**
 * SECTION: Shared investor Prospectus document CSS
 * WHY: Fixed A4 pages for screen + print; preview chrome only; no mobile reflow
 */

/** Fixed A4 geometry — never shrink with viewport. */
export const PROSPECTUS_A4_WIDTH_MM = 210;
export const PROSPECTUS_A4_HEIGHT_MM = 297;

/**
 * Shared outer page canvas padding for Pages 1–3 (top / horizontal / bottom).
 * Do not override per-page unless a temporary fit emergency is approved.
 */
export const PROSPECTUS_PAGE_PADDING_TOP_PX = 38;
export const PROSPECTUS_PAGE_PADDING_X_PX = 28;
export const PROSPECTUS_PAGE_PADDING_BOTTOM_PX = 28;
export const PROSPECTUS_PAGE_PADDING_CSS = `${PROSPECTUS_PAGE_PADDING_TOP_PX}px ${PROSPECTUS_PAGE_PADDING_X_PX}px ${PROSPECTUS_PAGE_PADDING_BOTTOM_PX}px`;

/** Shared header / logo sizing — identical on Pages 1–3. */
export const PROSPECTUS_HEADER_HEIGHT_PX = 66;
export const PROSPECTUS_LOGO_HEIGHT_PX = 56;
export const PROSPECTUS_LOGO_MAX_WIDTH_PX = 210;
export const PROSPECTUS_TAGLINE_FONT_SIZE_PX = 8.5;
export const PROSPECTUS_BRAND_GAP_PX = 14;

/** Shared section heading (card/section h2) — identical scale on Pages 1–3. */
export const PROSPECTUS_SECTION_TITLE_FONT_SIZE_PX = 12;
export const PROSPECTUS_SECTION_TITLE_MARGIN_BOTTOM_PX = 10;

/** Shared Page 3 page-title block (and any future page-level titles). */
export const PROSPECTUS_PAGE_TITLE_FONT_SIZE_PX = 22;
export const PROSPECTUS_PAGE_TITLE_PADDING_CSS = "20px 0 14px";
export const PROSPECTUS_PAGE_TITLE_MARGIN_BOTTOM_PX = 8;
export const PROSPECTUS_PAGE_SUBTITLE_FONT_SIZE_PX = 9;

/**
 * Screen + print stylesheet for investor Prospectus HTML.
 * - `.page` is always 210mm × 297mm (min and exact).
 * - Grey canvas / shadow / outer padding are preview-only.
 * - No max-width media queries that stack grids or reflow sections.
 */
export const PROSPECTUS_DOCUMENT_CSS = `
:root{
  --red:#b10810;--bright:#dc2a22;--pink:#edd1d1;--soft:#f8eded;--line:#c9c5c5;
  --ink:#171717;--muted:#5c5c5c;--green:#22b83f;--light-green:#dcefc8;
  --prospectus-a4-width:${PROSPECTUS_A4_WIDTH_MM}mm;
  --prospectus-a4-height:${PROSPECTUS_A4_HEIGHT_MM}mm;
  --prospectus-page-padding-top:${PROSPECTUS_PAGE_PADDING_TOP_PX}px;
  --prospectus-page-padding-x:${PROSPECTUS_PAGE_PADDING_X_PX}px;
  --prospectus-page-padding-bottom:${PROSPECTUS_PAGE_PADDING_BOTTOM_PX}px;
  --prospectus-page-padding:var(--prospectus-page-padding-top) var(--prospectus-page-padding-x) var(--prospectus-page-padding-bottom);
  --prospectus-header-height:${PROSPECTUS_HEADER_HEIGHT_PX}px;
  --prospectus-logo-height:${PROSPECTUS_LOGO_HEIGHT_PX}px;
  --prospectus-logo-max-width:${PROSPECTUS_LOGO_MAX_WIDTH_PX}px;
  --prospectus-tagline-font-size:${PROSPECTUS_TAGLINE_FONT_SIZE_PX}px;
  --prospectus-brand-gap:${PROSPECTUS_BRAND_GAP_PX}px;
  --prospectus-section-title-font-size:${PROSPECTUS_SECTION_TITLE_FONT_SIZE_PX}px;
  --prospectus-section-title-margin-bottom:${PROSPECTUS_SECTION_TITLE_MARGIN_BOTTOM_PX}px;
  --prospectus-page-title-font-size:${PROSPECTUS_PAGE_TITLE_FONT_SIZE_PX}px;
  --prospectus-page-title-padding:${PROSPECTUS_PAGE_TITLE_PADDING_CSS};
  --prospectus-page-title-margin-bottom:${PROSPECTUS_PAGE_TITLE_MARGIN_BOTTOM_PX}px;
  --prospectus-page-subtitle-font-size:${PROSPECTUS_PAGE_SUBTITLE_FONT_SIZE_PX}px;
}
*{box-sizing:border-box}
html{
  background:#ececec; /* preview-only grey canvas */
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
body{
  margin:0;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;
  color:var(--ink);
  font-size:10px;
  line-height:1.35;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
  overflow-x:auto; /* allow horizontal scroll when viewport < A4; do not reflow */
}
.document{
  padding:24px 0; /* preview-only outer padding */
  min-width:var(--prospectus-a4-width);
}
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
.page-header{height:var(--prospectus-header-height);border-bottom:2px solid #bd2c2c;display:flex;justify-content:space-between;align-items:center;margin-bottom:0;flex:none}
.brand{display:flex;align-items:center;gap:var(--prospectus-brand-gap);position:relative;min-width:0}
.brand-logo{height:var(--prospectus-logo-height);width:auto;max-width:var(--prospectus-logo-max-width);object-fit:contain;object-position:left center;flex:none;display:block}
.brand-mark-placeholder{width:var(--prospectus-logo-height);height:var(--prospectus-logo-height);border:2px solid var(--red);background:var(--red);border-radius:3px;flex:none}
.tagline{font-size:var(--prospectus-tagline-font-size);margin:0;color:var(--muted);line-height:1.3;white-space:nowrap}
.shariah{border:1.5px solid var(--red);border-radius:7px;padding:7px 11px;font-size:8px;display:flex;align-items:center;gap:6px;white-space:nowrap;flex:none}.shariah-mark{font-size:14px;color:var(--red);line-height:1}
h1,h2,p{margin-top:0}
/* Shared section titles (Pages 1–3) — do not shrink per page */
h2{
  font-size:var(--prospectus-section-title-font-size);
  font-weight:700;
  line-height:1.25;
  letter-spacing:0;
  text-transform:uppercase;
  color:#a51d21;
  margin-bottom:var(--prospectus-section-title-margin-bottom);
}
.hero-grid{display:grid;grid-template-columns:1.35fr 1fr .82fr;border-bottom:1px solid var(--line);min-height:210px}
.hero-grid>div{padding:18px 14px}.hero-grid>div+div{border-left:1px solid var(--line)}
.eyebrow{text-transform:uppercase;font-weight:800;color:#a51d21;font-size:var(--prospectus-section-title-font-size);line-height:1.25;margin-bottom:6px}
.hero-copy h1{font-size:32px;letter-spacing:-1.2px;margin:0 0 4px}.product-pill{display:inline-block;background:#e7bbbb;color:#a32424;font-weight:800;text-transform:uppercase;border-radius:4px;padding:6px 8px;margin-bottom:14px}
.hero-copy p{font-size:11px;max-width:280px;margin:0}
.meta-row{display:flex;gap:12px;margin-bottom:18px;align-items:flex-start}.meta-row .icon{width:22px;height:22px;color:#bf2a30;flex:none}.meta-row b,.meta-row span{display:block}.meta-row b{font-size:10px}.meta-row span{font-size:9px;margin-top:2px}
/* Four timeline rows in the middle hero column — slightly tighter than generic meta-row */
.key-dates .meta-row{margin-bottom:12px}.key-dates .meta-row:last-child{margin-bottom:0}
.risk-panel{text-align:left}.risk-panel>b{font-size:10px}.shield{width:67px;height:73px;background:var(--green);color:white;font-size:22px;font-weight:800;display:grid;place-items:center;margin:8px auto 2px;clip-path:polygon(50% 0,92% 18%,84% 72%,50% 100%,16% 72%,8% 18%)}
.risk-panel strong{display:block;text-align:center;font-size:12px}.risk-panel p{font-size:9px;margin:10px 0}.risk-panel .scale-link{font-size:8px;font-weight:800;color:#a51d21;text-decoration:none}
.card{border:1px solid #bdb9b9;border-radius:8px;overflow:hidden}
.split-card{display:grid;grid-template-columns:1fr 1.05fr;margin-top:8px}.split-card>div{padding:15px}.split-card>div+div{border-left:1px solid var(--line)}
.summary-list{margin:0}.summary-list div{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d4d1d1;padding:5px 0}.summary-list div:last-child{border-bottom:0}
.summary-list dt{font-weight:700;padding-left:28px;position:relative}.summary-list dt:before{content:"";width:18px;height:18px;background:#e3bfc0;border-radius:3px;position:absolute;left:0;top:-2px}.summary-list dd{margin:0;text-align:right}
.tick-item{display:flex;gap:11px;margin-bottom:13px}.tick-item>span{width:19px;height:19px;border-radius:50%;background:#20be3f;color:#fff;font-size:15px;font-weight:800;display:grid;place-items:center;flex:none}.tick-item p{font-size:9px;margin:0}.tick-item b{display:block;font-size:10px;margin-bottom:3px}
.strip{border:1px solid #c2bebe;border-top:0;padding:15px 15px 10px}.strip h2,.track h2{margin-bottom:10px}
.stats{display:grid;gap:8px}.stats.five{grid-template-columns:repeat(5,1fr)}.stats.four{grid-template-columns:repeat(4,1fr)}
.stat{display:grid;grid-template-columns:34px 1fr;grid-template-rows:auto auto;column-gap:7px;align-items:center}.stat .icon{grid-row:1/3;background:#efcecf;color:#b62c33;border-radius:50%;padding:7px;width:34px;height:34px;box-sizing:border-box}.stat small{font-size:7px}.stat b{font-size:11px}
.track{border:1px solid #c2bebe;border-top:0;border-radius:0 0 8px 8px;padding:15px}.track .stats{margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:8px}th{background:#df2b23;color:#fff;padding:7px 5px;font-weight:600}td{border:1px solid #e1dddd;padding:5px;text-align:center}td:first-child,th:first-child{text-align:left}
.table-wrap{overflow-x:auto}.track em,.financial-card em,.card em,.source{display:block;font-size:7px;margin-top:8px;font-style:italic}
.prospectus-footer,footer.prospectus-footer{margin-top:auto;display:flex;align-items:center;gap:8px;padding-top:14px;font-size:7px;color:var(--muted)}.prospectus-footer .icon{color:#b3131b;width:24px;height:24px;flex:none}
.issuer-grid{display:grid;grid-template-columns:.9fr 1.1fr}.issuer-grid>section{padding:20px 14px}.issuer-grid>section+section{border-left:1px solid var(--line)}
.issuer-profile{display:flex;gap:18px;align-items:center;margin:20px 0}.round-icon{width:76px;height:76px;border-radius:50%;background:#efcecf;display:grid;place-items:center;color:#ae262c}.round-icon .icon{width:44px;height:44px}.issuer-profile span,.issuer-profile b{display:block;margin-bottom:8px}.issuer-grid p{font-size:9px;margin:0}
.invoice-info dl{margin:0}.invoice-info dl div{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.invoice-info dt{display:flex;align-items:center;gap:10px;font-weight:700}.invoice-info dt .icon,.work-list .icon{width:30px;height:30px;padding:6px;background:#efcecf;border-radius:50%;color:#b22a30;box-sizing:border-box}.invoice-info dd{margin:0;text-align:right}
.financial-card{display:grid;grid-template-columns:.34fr .66fr}.financial-card>div{padding:12px}.financial-card>div+div{border-left:1px solid var(--line)}.summary-list.compact dt{padding-left:0}.summary-list.compact dt:before{display:none}.plain th{background:#f2f0f0;color:#111}.plain td,.plain th{text-align:center}.plain td:first-child,.plain th:first-child{text-align:left}
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
.credit-insights-note{display:block;font-size:7px;margin-top:8px;font-style:italic;line-height:1.3;color:var(--muted)}
.lower{margin-top:0;border-top:0;border-radius:0 0 8px 8px}.ratings div{display:grid;grid-template-columns:1fr 110px;gap:8px;align-items:center;margin:5px 0;position:relative}.ratings div:before{content:"";width:17px;height:17px;background:#e3bfc0;border-radius:3px;position:absolute;left:0}.ratings span{font-weight:700;padding-left:22px}.ratings b{background:#d8d8d8;text-align:center;padding:5px;border-radius:4px;font-weight:500}.ratings .good{color:#21a43b}
.work-list p{display:flex;align-items:flex-start;gap:10px;font-size:9px;margin-bottom:9px}.work-list .icon{flex:none;width:25px;height:25px;padding:4px;box-sizing:border-box}
.risk-cta{display:grid;grid-template-columns:2fr 1fr;gap:9px;margin-top:8px}.risk-cta>.card{padding:10px}

/* Page 2 only — minor internal fit tweaks (never shrink shared titles / outer padding / header) */
.prospectus-page-two .issuer-profile{margin:16px 0}
.prospectus-page-two .invoice-info dl div{margin-bottom:11px}
.prospectus-page-two .ratings div{margin:4px 0}
.prospectus-page-two .work-list p{margin-bottom:7px}
.prospectus-page-two .risk-cta{margin-top:7px}
.prospectus-page-two .invest-confidence-description{margin:0 0 7px;line-height:1.3}
.prospectus-page-two .soukscore-scale .grade-item{padding:5px 3px}
.soukscore-scale,.risk-scale{display:grid;grid-template-columns:repeat(6,1fr);list-style:none;margin:0;padding:0;align-items:start}
.soukscore-scale .grade-item,.risk-scale>div{padding:6px 4px;border-right:1px solid #c9c5c5;text-align:center}.soukscore-scale .grade-item:last-child,.risk-scale>div:last-child{border:0}
.soukscore-scale .grade,.grade{width:33px;height:33px;color:#fff;border-radius:6px;display:grid;place-items:center;font-size:12px;margin:0 auto 4px;background:#79cf54;font-weight:800}
.soukscore-scale .grade-label{display:block;font-size:7px;font-weight:700;line-height:1.25;margin:0 0 3px}
.soukscore-scale .grade-desc{display:block;font-size:6px;line-height:1.3;color:#555;font-weight:400}
.soukscore-scale .grade-item.is-selected,.soukscore-scale .grade-item[data-selected="true"]{background:#f7f7f7}
.soukscore-scale .grade-item.is-selected .grade,.soukscore-scale .grade-item[data-selected="true"] .grade{outline:2px solid #111;outline-offset:2px}
.soukscore-missing{margin:8px 0 0;font-size:8px}
.issuer-profile .issuer-meta-line{font-size:10px;font-weight:700;margin-bottom:6px}
.plain th .fy-label,.report-box th .fy-label{display:block;font-weight:700}
.plain th .fy-end,.report-box th .fy-end{display:block;font-size:7px;font-weight:400;margin-top:2px;color:#666}
.cta{border:1px solid #c5bebe;border-radius:7px;background:#f7eaea;padding:11px}.cta p{font-size:9px}.cta-button{display:block;width:100%;border:0;border-radius:5px;background:#a60000;color:#fff;text-transform:uppercase;font-weight:800;padding:8px;font-size:11px;text-align:center;text-decoration:none}.cta-button[disabled],.cta-button[aria-disabled="true"]{opacity:.85;cursor:default;pointer-events:none}.cta-minimum{text-align:center;display:block;margin-top:7px;font-size:8px}
.risk-scale-note{margin:6px 0 0;font-size:7.5px;line-height:1.25;font-style:italic;color:var(--muted)}
.invest-confidence-description{margin:0 0 8px;font-size:9px;line-height:1.3}
/* Shared page-level title block (Page 3 today; same tokens if reused elsewhere) */
.page-title{padding:var(--prospectus-page-title-padding)}
.page-title h1,.page-title h2{
  text-transform:uppercase;
  color:#a8181d;
  font-size:var(--prospectus-page-title-font-size);
  font-weight:700;
  line-height:1.2;
  letter-spacing:0;
  margin:0 0 var(--prospectus-page-title-margin-bottom);
}
.page-title p{font-size:var(--prospectus-page-subtitle-font-size);margin:0;line-height:1.35;color:var(--ink)}
.identity-strip,.meta-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin-bottom:18px}.identity-strip>div,.meta-strip-item{display:flex;gap:9px;padding:12px 9px;border-right:1px solid #c8c4c4;align-items:flex-start}.identity-strip>div:last-child,.meta-strip-item:last-child{border-right:0}.identity-strip .icon,.meta-strip-item .icon{width:32px;height:32px;padding:7px;background:#efcecf;border-radius:50%;color:#b0292f;flex:none;box-sizing:border-box}.meta-strip-label,.identity-strip small{font-weight:800;font-size:7px;display:block}.meta-strip-value,.identity-strip b{font-size:8px;margin-top:5px;display:block}
.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.report-box{padding:9px}.report-box h2{font-size:11px}.report-box table{font-size:7.5px}.report-box th{font-size:7px}.report-box td{height:24px}
.insight{background:var(--light-green);border-radius:7px;padding:9px;display:flex;align-items:center;gap:8px;margin-top:8px;font-size:8px}.insight .icon{width:30px;height:30px;background:#1dbb3d;color:#fff;border-radius:50%;padding:5px;box-sizing:border-box}
.trend-cell{text-align:center;vertical-align:middle}
.trend-cell.up,.up{color:#28ad46;font-size:28px;font-weight:800;line-height:15px}.trend-cell.down,.down{color:#ce201d;font-size:28px;font-weight:800;line-height:15px}
.takeaways p,.takeaway-item{display:flex;gap:10px;align-items:center;font-size:8.5px;margin:0 0 12px}.takeaways .icon,.takeaway-item .icon{flex:none;width:34px;height:34px;background:#efcecf;color:#b52a30;border-radius:50%;padding:7px;box-sizing:border-box}.source{margin-left:12px}

/* Page 3 — reference-aligned sizing (no aggressive compress / no spacer auto-margin) */
.prospectus-page-three .report-box th .fy-end{color:#fff;opacity:.92;font-size:7px}
.prospectus-page-three .takeaways{display:flex;flex-direction:column;min-height:100%}
.prospectus-page-three .takeaways-empty{display:flex;align-items:center;justify-content:center;flex:1;min-height:220px;margin:0;font-size:14px;color:var(--muted)}
.prospectus-page-three>.source{margin:10px 0 0 12px}
.prospectus-page-three>.prospectus-footer{margin-top:8px;padding-top:8px}

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
