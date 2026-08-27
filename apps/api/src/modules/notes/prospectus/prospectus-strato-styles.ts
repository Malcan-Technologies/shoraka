/**
 * Namespaced MARC appendix CSS. Isolated from Pages 1–3 prospectus table/header rules.
 * Geometry matches production A4 Playwright pages (mm), not the 794px static mock.
 */

export const PROSPECTUS_STRATO_CSS = `
.page.strato-page{
  --strato-blue:#0a255c;--strato-red:#a40000;--strato-light-blue:#d9e3f3;--strato-grid:#a9a9a9;
  position:relative;padding:12px 15px 24px;color:#111;font-family:Arial,Helvetica,sans-serif;
  font-size:11px;line-height:1.18;display:flex;flex-direction:column;overflow:hidden;
}
.strato-header{height:64px;display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:2;flex-shrink:0}
.strato-marc-logo{margin-top:0;padding:2px 7px 1px;font-family:"Times New Roman",serif;font-size:32px;font-weight:700;line-height:1;letter-spacing:-1.5px;color:var(--strato-red);border-top:3px solid var(--strato-blue);border-bottom:3px solid var(--strato-blue)}
.strato-report-title{color:var(--strato-blue);text-align:right;font-weight:700;font-size:18px;line-height:1.05;padding-top:4px}
.strato-section-title{position:relative;z-index:2;width:100%;padding:5px 10px 4px;margin:6px 0 12px;border-radius:5px;background:var(--strato-light-blue);color:var(--strato-blue);text-align:center;font-weight:700;font-size:13px}
.strato-methodology-title{margin-top:16px;margin-bottom:10px}.strato-disclaimer-title{margin-top:14px;margin-bottom:10px}
.strato-table-wrap{position:relative;z-index:2;width:100%;overflow:visible}
.strato-page .strato-table{width:100%;border-collapse:collapse;color:#111;font-size:10px;line-height:1.08;margin:0}
.strato-page .strato-table th,.strato-page .strato-table td{border:1px solid var(--strato-grid);padding:3px 6px;vertical-align:middle}
.strato-page .strato-table thead th{background:var(--strato-light-blue);color:var(--strato-blue);font-weight:700}
.strato-score-table th:nth-child(-n+3),.strato-score-table td:nth-child(-n+3){text-align:center}
.strato-score-table th:nth-child(1){width:14%}.strato-score-table th:nth-child(2){width:14%}.strato-score-table th:nth-child(3){width:12%}.strato-score-table th:nth-child(4){width:60%;text-align:left}
.strato-copy,.strato-final-copy,.strato-disclaimer-copy{position:relative;z-index:2;text-align:justify}
.strato-copy{font-size:10.5px;line-height:1.2;margin-bottom:10px}.strato-copy p{margin:0 0 4px}
.strato-factors-table th{text-align:left}.strato-factors-table td{padding:2px 7px 3px}
.strato-footnote{position:relative;z-index:2;margin:3px 1px 0;font-size:9px;font-weight:700}
.strato-final-copy{font-size:10.5px;line-height:1.25}.strato-final-copy p{margin:0 0 8px}.strato-final-copy ul{margin:3px 0 0 18px;padding:0}.strato-final-copy li{margin:1px 0}
.strato-disclaimer-copy{font-size:8.6px;line-height:1.22}.strato-disclaimer-copy p{margin:0 0 6px}.strato-uppercase{font-weight:700}.strato-end-report{margin-top:10px;text-align:center;font-weight:700}
.strato-confidential{margin-top:auto;font-size:8px;font-weight:700;letter-spacing:.02em;padding-top:8px}
`;
