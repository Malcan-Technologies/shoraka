import { formatNoteReferenceDisplay } from "@cashsouk/types";
import { escapeHtml } from "../prospectus/prospectus-html";
import type { InvestmentSettlementConfirmationSnapshot } from "./types";

function formatRm(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatFee(amount: number): string {
  return `(${formatRm(amount)})`;
}

const PRINT_CSS = `* { box-sizing: border-box; }
:root {
  --burgundy: #76060b;
  --burgundy-dark: #650006;
  --green: #086d13;
  --green-soft: #eef8ee;
  --green-border: #9bcf9d;
  --gold: #f1b73e;
  --gold-dark: #9d6400;
  --text: #151515;
  --line: #d7d7d7;
  --card-border: #e7ddd3;
}
@page { size: A4; margin: 10mm 12mm; }
html, body { margin: 0; }
body {
  font-family: Arial, Helvetica, sans-serif;
  color: var(--text);
  background: #fff;
}
.page-shell { width: 100%; max-width: 805px; margin: 0 auto; }
.confirmation-card {
  padding: 22px 40px 28px;
  border: 1px solid var(--card-border);
  border-radius: 17px;
  background: #fff;
  text-align: center;
}
.success-icon {
  width: 96px; height: 96px; margin: 0 auto 4px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 50%, #eff7ef 51%, #edf7ed 67%, rgba(237,247,237,.25) 68%);
  display: grid; place-items: center;
}
.success-icon svg { width: 72px; height: 72px; overflow: visible; }
.success-icon circle { fill: none; stroke: var(--green); stroke-width: 5; }
.success-icon path { fill: none; stroke: var(--green); stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
h1 {
  margin: 6px 0 16px;
  color: var(--burgundy-dark);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 32px;
  line-height: 1.16;
  font-weight: 700;
  letter-spacing: -0.4px;
}
.status-pill {
  width: max-content; margin: 0 auto 12px; padding: 6px 18px 6px 15px;
  border: 1px solid #b8dfba; border-radius: 10px;
  background: linear-gradient(90deg, #eff9ef, #f7fcf7);
  color: var(--green); display: flex; align-items: center; gap: 8px;
  font-size: 22px; line-height: 1; font-weight: 500;
}
.status-pill svg { width: 28px; height: 28px; fill: none; stroke: var(--green); stroke-width: 2.1; stroke-linejoin: round; }
.status-pill .tick { stroke-width: 2.7; stroke-linecap: round; }
.intro { max-width: 610px; margin: 10px auto 16px; font-size: 15px; line-height: 1.48; font-weight: 400; }
.divider { height: 1px; margin: 12px 0 14px; background: var(--line); }
.details { margin: 0; }
.detail-row {
  display: grid; grid-template-columns: 1fr auto; gap: 20px;
  align-items: center; min-height: 32px; text-align: left; font-size: 15px; line-height: 1.25;
}
.detail-row dt, .detail-row dd { margin: 0; }
.detail-row dd { min-width: 180px; text-align: right; font-weight: 400; }
.divider--compact { margin-top: 4px; margin-bottom: 8px; }
.financials .detail-row dd { font-weight: 500; }
.financials .detail-row .negative { color: #7b060c; }
.divider--financial { margin: 0 4px 8px 0; }
.net-row { min-height: 28px; padding: 0; }
.net-row strong { min-width: 180px; text-align: right; color: var(--green); font-size: 15px; font-weight: 500; }
.total-box {
  min-height: 52px; margin-top: 8px; padding: 8px 22px;
  border: 1px solid var(--green-border); border-radius: 7px;
  background: linear-gradient(90deg, #f3faf2, #fbfdf9 52%, #eff8ee);
  display: flex; align-items: center; justify-content: space-between; color: var(--green);
}
.total-box span { font-size: 16px; font-weight: 700; }
.total-box strong {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 28px; line-height: 1; font-weight: 700; letter-spacing: .4px;
}
.notice-box {
  min-height: 64px; margin-top: 10px; padding: 10px 18px;
  border: 1px solid #efbd4f; border-radius: 7px;
  background: linear-gradient(90deg, rgba(255,249,236,.9), rgba(255,252,245,.75));
  display: flex; align-items: flex-start; gap: 16px; text-align: left;
}
.notice-icon {
  flex: 0 0 28px; width: 28px; height: 28px; margin-top: 1px;
  border: 2px solid var(--gold-dark); border-radius: 50%; color: var(--gold-dark);
  display: grid; place-items: center; font-family: Georgia, serif; font-size: 18px; font-weight: 700; line-height: 1;
}
.notice-box p { margin: 0; font-size: 14px; line-height: 1.42; }
.notice-box strong { font-weight: 700; }`;

export function buildInvestmentSettlementConfirmationHtml(
  snapshot: InvestmentSettlementConfirmationSnapshot
): string {
  const noteId = formatNoteReferenceDisplay(snapshot.noteReference) || snapshot.noteReference;
  const tawidhRow = snapshot.showTawidh
    ? `<div class="detail-row">
        <span>Ta’widh compensation</span>
        <strong>${escapeHtml(formatRm(snapshot.tawidhCompensation))}</strong>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Investment Settlement Confirmation</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <main class="page-shell">
    <section class="confirmation-card" aria-labelledby="page-title">
      <div class="success-icon" aria-hidden="true">
        <svg viewBox="0 0 100 100" role="img">
          <circle cx="50" cy="50" r="47"></circle>
          <path d="M29 51.5 43.5 66 72 36"></path>
        </svg>
      </div>
      <h1 id="page-title">Investment Settlement Confirmation</h1>
      <div class="status-pill">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 2.5l3.1 3.1 4.3-.2 1.5 4 3.8 2.1-.7 4.3 2.4 3.6-2.4 3.6.7 4.3-3.8 2.1-1.5 4-4.3-.2L16 36.5l-3.1-3.1-4.3.2-1.5-4-3.8-2.1.7-4.3-2.4-3.6L4 16l-.7-4.3 3.8-2.1 1.5-4 4.3.2L16 2.5z" transform="scale(.84) translate(3 0)"></path>
          <path class="tick" d="m11.2 16.1 3.3 3.4 6.5-7"></path>
        </svg>
        <span>${escapeHtml(snapshot.statusLabel)}</span>
      </div>
      <p class="intro">${escapeHtml(snapshot.introCopy)}</p>
      <div class="divider"></div>
      <dl class="details">
        <div class="detail-row"><dt>Note ID</dt><dd>${escapeHtml(noteId)}</dd></div>
        <div class="detail-row"><dt>Issuer ID</dt><dd>${escapeHtml(snapshot.issuerReference)}</dd></div>
        <div class="detail-row"><dt>Settlement date</dt><dd>${escapeHtml(snapshot.settlementDateDisplay)}</dd></div>
      </dl>
      <div class="divider divider--compact"></div>
      <dl class="details financials">
        <div class="detail-row"><dt>Principal returned</dt><dd>${escapeHtml(formatRm(snapshot.principalReturned))}</dd></div>
        <div class="detail-row"><dt>Gross profit earned</dt><dd>${escapeHtml(formatRm(snapshot.grossProfitEarned))}</dd></div>
        <div class="detail-row"><dt>${escapeHtml(snapshot.serviceFeeLabel)}</dt><dd class="negative">${escapeHtml(formatFee(snapshot.serviceFeeAmount))}</dd></div>
      </dl>
      <div class="divider divider--financial"></div>
      <div class="detail-row net-row">
        <span>Net profit credited</span>
        <strong>${escapeHtml(formatRm(snapshot.netProfitCredited))}</strong>
      </div>
      ${tawidhRow}
      <div class="total-box">
        <span>Total credited to wallet</span>
        <strong>${escapeHtml(formatRm(snapshot.totalCreditedToWallet))}</strong>
      </div>
      <aside class="notice-box">
        <div class="notice-icon" aria-hidden="true">i</div>
        <p><strong>Processing notice:</strong> ${escapeHtml(snapshot.processingNotice)}</p>
      </aside>
    </section>
  </main>
</body>
</html>`;
}
