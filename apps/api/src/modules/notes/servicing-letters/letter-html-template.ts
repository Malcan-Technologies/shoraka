import { getProspectusOfficialLogoDataUri } from "../prospectus/prospectus-header-logo";
import { PROSPECTUS_HEADER_TAGLINE } from "../prospectus/prospectus-static-copy";

export type ServicingLetterKind = "ARREARS" | "DEFAULT";

export type ServicingLetterTemplateData = {
  kind: ServicingLetterKind;
  noteReference: string;
  issuerName: string;
  dueDateLabel: string;
  daysPastDue: number;
  outstandingTotalLabel: string;
  indicativeTawidhLabel: string;
  indicativeGharamahLabel: string;
  gracePeriodDays: number;
  arrearsThresholdDays: number;
  generatedAtLabel: string;
  defaultDateLabel?: string | null;
  defaultReason?: string | null;
};

const LOGO_WIDTH_PX = 176;
const LOGO_HEIGHT_PX = 34;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function buildBrandMarkHtml(): string {
  const dataUri = getProspectusOfficialLogoDataUri();
  if (dataUri) {
    return `<img class="brand-logo" src="${dataUri}" alt="CashSouk" width="${LOGO_WIDTH_PX}" height="${LOGO_HEIGHT_PX}" />`;
  }
  return `<div class="brand-wordmark">CashSouk</div>`;
}

export function servicingLetterTitle(kind: ServicingLetterKind): string {
  return kind === "DEFAULT" ? "Default Notice" : "Arrears Notice";
}

export function buildServicingLetterHtml(data: ServicingLetterTemplateData): string {
  const title = servicingLetterTitle(data.kind);
  const nextSteps =
    data.kind === "DEFAULT"
      ? "This note has been marked as default. CashSouk will pursue recovery of outstanding principal, contractual profit, and any approved Ta'widh. Please contact CashSouk immediately to discuss settlement."
      : "Please settle the outstanding amount immediately. If repayment is not received, the note may be marked as default and recovery action may follow.";

  const defaultRows =
    data.kind === "DEFAULT"
      ? `${row("Default date", data.defaultDateLabel)}${row("Default reason", data.defaultReason)}`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} ${escapeHtml(data.noteReference)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Arial, Helvetica, sans-serif;
      color: #18181b;
      font-size: 11.5px;
      line-height: 1.45;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .accent-bar {
      height: 5px;
      background: linear-gradient(90deg, #8A0304 0%, #CE2922 55%, #BAA38B 100%);
      margin: 0 0 22px;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 28px; margin-bottom: 22px; }
    .brand-logo { display: block; width: ${LOGO_WIDTH_PX}px; height: ${LOGO_HEIGHT_PX}px; object-fit: contain; object-position: left center; margin: 0 0 12px; }
    .brand-wordmark { font-size: 22px; font-weight: 700; letter-spacing: 0.02em; color: #8A0304; margin: 0 0 10px; }
    .brand-tagline { font-size: 10px; font-weight: 600; letter-spacing: 0.02em; color: #6F4924; margin: 0 0 8px; }
    .title-card {
      flex: 0 0 240px; width: 240px; border: 1px solid #e4e4e7; border-top: 3px solid #8A0304;
      background: #fafafa; padding: 14px 16px; text-align: right;
    }
    .title-card h1 { margin: 0 0 12px; font-size: 15px; font-weight: 700; letter-spacing: 0.08em; color: #8A0304; line-height: 1.2; }
    .section { margin-top: 20px; border: 1px solid #e4e4e7; border-radius: 4px; overflow: hidden; }
    .section-head {
      margin: 0; padding: 9px 14px; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; color: #6F4924; background: #f8f5f1; border-bottom: 1px solid #e8e0d6;
    }
    .section-body { padding: 12px 14px 14px; }
    table.kv { width: 100%; border-collapse: collapse; }
    table.kv th, table.kv td { padding: 8px 0; vertical-align: top; text-align: left; border-bottom: 1px solid #f4f4f5; }
    table.kv tr:last-child th, table.kv tr:last-child td { border-bottom: none; }
    table.kv th { width: 38%; color: #71717a; font-weight: 600; padding-right: 16px; }
    table.kv td { color: #18181b; font-weight: 500; word-break: break-word; }
    .body-copy { margin: 0 0 10px; color: #3f3f46; }
    .footer {
      margin-top: 32px; padding-top: 14px; border-top: 1px solid #e4e4e7;
      font-size: 10px; color: #a1a1aa; text-align: center;
    }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="header">
    <div>
      ${buildBrandMarkHtml()}
      <div class="brand-tagline">${escapeHtml(PROSPECTUS_HEADER_TAGLINE)}</div>
    </div>
    <div class="title-card">
      <h1>${escapeHtml(title.toUpperCase())}</h1>
      <div>${escapeHtml(data.generatedAtLabel)}</div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-head">Note</h2>
    <div class="section-body">
      <table class="kv">
        ${row("Note reference", data.noteReference)}
        ${row("Issuer", data.issuerName)}
        ${row("Payment due date", data.dueDateLabel)}
        ${row("Days past due", String(data.daysPastDue))}
        ${row("Outstanding amount", data.outstandingTotalLabel)}
        ${row("Indicative Ta'widh", data.indicativeTawidhLabel)}
        ${row("Indicative Gharamah", data.indicativeGharamahLabel)}
        ${row("Grace period (days)", String(data.gracePeriodDays))}
        ${row("Arrears threshold (days)", String(data.arrearsThresholdDays))}
        ${defaultRows}
      </table>
    </div>
  </div>
  <div class="section">
    <h2 class="section-head">Next steps</h2>
    <div class="section-body">
      <p class="body-copy">${escapeHtml(nextSteps)}</p>
      <p class="body-copy">Indicative Ta'widh and Gharamah are estimates only. The amounts applied are confirmed by CashSouk at settlement and may be waived in whole or in part.</p>
    </div>
  </div>
  <div class="footer">CashSouk P2P Financing Platform · Official servicing notice</div>
</body>
</html>`;
}
