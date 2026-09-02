import { getProspectusOfficialLogoDataUri } from "../prospectus/prospectus-header-logo";
import { escapeHtml } from "../prospectus/prospectus-html";
import {
  SETTLEMENT_CONFIRMATION_COPY,
  type SettlementHibahReceiptSnapshot,
} from "./types";

const FOOTER_COMPANY = "SHORAKA SUYULA PLATFORM SDN BHD (1433328-H) 202101033028";
const FOOTER_ADDRESS =
  "LEVEL 19, WISMA MONT’ KIARA, NO. 1, JALAN KIARA, MONT KIARA, 50480 KUALA LUMPUR, MALAYSIA";
const FOOTER_CONTACT = "T: +603-2708 8100 E: enquiry@cashsouk.com W: www.cashsouk.com";

function formatRm(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCredit(amount: number): string {
  return `(${formatAmount(amount)})`;
}

function kvPair(label: string, value: string): string {
  return `<div class="kv"><span class="k">${escapeHtml(label)}</span><span class="v">${escapeHtml(value)}</span></div>`;
}

function amountRow(description: string, basis: string, amount: string, options?: { total?: boolean }): string {
  const cls = options?.total ? " total" : "";
  return `<tr class="${cls}">
    <td>${escapeHtml(description)}</td>
    <td>${escapeHtml(basis)}</td>
    <td class="num">${escapeHtml(amount)}</td>
  </tr>`;
}

export function buildSettlementHibahReceiptHtml(snapshot: SettlementHibahReceiptSnapshot): string {
  const logo = getProspectusOfficialLogoDataUri();
  const logoHtml = logo
    ? `<img class="logo" src="${logo}" alt="CashSouk" />`
    : `<div class="logo-fallback">CashSouk</div>`;
  const financingId = snapshot.facilityReference
    ? `${snapshot.noteReference} / ${snapshot.facilityReference}`
    : snapshot.noteReference;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(snapshot.receiptNumber)}</title>
  <style>
    @page { size: A4; margin: 12mm 11mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1a1a1a;
      font-family: "Liberation Serif", "Times New Roman", Times, serif;
      font-size: 10.5pt;
      line-height: 1.35;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .logo { height: 38px; width: auto; }
    .logo-fallback { font-weight: 700; font-size: 16pt; color: #8B1E1E; }
    h1 { font-size: 15pt; letter-spacing: 0.04em; margin: 0 0 4px; text-align: center; }
    .banner {
      text-align: center;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #8B1E1E;
      margin: 0 0 12px;
    }
    h2 {
      font-size: 9.5pt;
      letter-spacing: 0.06em;
      margin: 12px 0 5px;
      border-bottom: 1px solid #8B1E1E;
      padding-bottom: 2px;
      color: #8B1E1E;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
    .kv { display: flex; gap: 8px; font-size: 9.5pt; padding: 2px 0; }
    .k { width: 42%; font-weight: 600; color: #444; }
    .v { flex: 1; }
    table.grid-amt { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 9pt; }
    table.grid-amt th, table.grid-amt td { border: 1px solid #ccc; padding: 4px 6px; }
    table.grid-amt th { background: #f4f0ea; font-weight: 600; text-align: left; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    tr.total td { font-weight: 700; background: #f7f4ef; }
    .legal { font-size: 9pt; margin: 8px 0; text-align: justify; }
    .sign { margin: 22px 0 8px; width: 46%; font-size: 9pt; }
    .line { border-top: 1px solid #222; margin-top: 28px; padding-top: 4px; }
    .footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      font-size: 8pt;
      color: #555;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">${logoHtml}</div>
  <h1>SETTLEMENT AND HIBAH RECEIPT</h1>
  <p class="banner">PAID — ISSUER COPY</p>

  <div class="grid">
    ${kvPair("Receipt no.", snapshot.receiptNumber)}
    ${kvPair("Receipt date", snapshot.receiptDateDisplay)}
    ${kvPair("Issuer ID", snapshot.issuerReference)}
    ${kvPair("Issuer", snapshot.issuerLegalName)}
    ${kvPair("Company no.", snapshot.issuerCompanyNumber)}
    ${kvPair("Financing ID", financingId)}
    ${kvPair("Paymaster", snapshot.paymasterName)}
    ${kvPair("Underlying invoice", snapshot.invoiceNumber)}
    ${kvPair("Invoice face value", formatRm(snapshot.invoiceFaceValue))}
    ${kvPair("Maturity date", snapshot.maturityDateDisplay)}
    ${kvPair("Cleared value date", snapshot.clearedValueDateDisplay)}
    ${kvPair("Payment reference", snapshot.paymentReference)}
    ${kvPair("Settlement status", snapshot.settlementStatus)}
  </div>

  <h2>GROSS COLLECTION</h2>
  <table class="grid-amt">
    <thead>
      <tr>
        <th>Description</th>
        <th>Basis / reference</th>
        <th class="num">Amount (RM)</th>
      </tr>
    </thead>
    <tbody>
      ${amountRow(
        "Gross amount received from paymaster / issuer",
        "Underlying invoice proceeds",
        formatAmount(snapshot.grossReceiptAmount)
      )}
    </tbody>
  </table>

  <h2>APPLICATION TOWARDS SETTLEMENT</h2>
  <table class="grid-amt">
    <thead>
      <tr>
        <th>Description</th>
        <th>Basis / reference</th>
        <th class="num">Amount (RM)</th>
      </tr>
    </thead>
    <tbody>
      ${amountRow("Outstanding financing principal", "At contractual maturity", formatAmount(snapshot.investorPrincipal))}
      ${amountRow("Contracted profit payable", "Full tenure to maturity", formatAmount(snapshot.investorProfitGross))}
      ${amountRow("Unpaid contractual fees", "If applicable", formatAmount(snapshot.unpaidContractualFees))}
      ${amountRow("Ta’widh", "After due date, if applicable", formatAmount(snapshot.tawidhAmount))}
      ${amountRow("Gharamah", "After due date, if applicable", formatAmount(snapshot.gharamahAmount))}
      ${amountRow("Less: prior payments / credits", "If applicable", formatCredit(snapshot.priorPaymentsCredits))}
      ${amountRow("TOTAL APPLIED TOWARDS FULL SETTLEMENT", "Amount discharged", formatAmount(snapshot.totalApplied), { total: true })}
    </tbody>
  </table>

  <h2>HIBAH (REFUND)</h2>
  <table class="grid-amt">
    <thead>
      <tr>
        <th>Description</th>
        <th>Basis / reference</th>
        <th class="num">Amount (RM)</th>
      </tr>
    </thead>
    <tbody>
      ${amountRow("Gross amount received from paymaster", "A", formatAmount(snapshot.grossReceiptAmount))}
      ${amountRow("Less: amount applied towards settlement", "B", formatCredit(snapshot.totalApplied))}
      ${amountRow("HIBAH (REFUND) GRANTED TO ISSUER", "A less B", formatAmount(snapshot.hibahAmount), { total: true })}
    </tbody>
  </table>

  <h2>HIBAH DETAILS AND FINAL RECONCILIATION</h2>
  <div class="grid">
    ${kvPair("Investor Schedule ref.", snapshot.investorScheduleReference)}
    ${kvPair("Financing Note ID", snapshot.noteReference)}
    ${kvPair("Hibah grantor", snapshot.hibahGrantor)}
    ${kvPair("Hibah recipient", snapshot.hibahRecipient)}
  </div>
  <div class="kv" style="margin-top:4px">
    <span class="k">Acting through</span>
    <span class="v">${escapeHtml(snapshot.actingThrough)}</span>
  </div>
  <div class="grid">
    ${kvPair("Payment date", snapshot.paymentDateDisplay)}
    ${kvPair("Payment reference", snapshot.paymentReference)}
    ${kvPair("Financing settled", formatRm(snapshot.totalApplied))}
    ${kvPair("Hibah to issuer", formatRm(snapshot.hibahAmount))}
    ${kvPair("Total allocated", formatRm(snapshot.totalAllocated))}
    ${kvPair("Unallocated balance", formatRm(snapshot.unallocatedBalance))}
  </div>

  <h2>SETTLEMENT CONFIRMATION</h2>
  <p class="legal">${escapeHtml(SETTLEMENT_CONFIRMATION_COPY)}</p>

  <div class="sign">
    <div class="line">Company Stamp</div>
  </div>

  <div class="footer">
    <div>${escapeHtml(FOOTER_COMPANY)}</div>
    <div>${escapeHtml(FOOTER_ADDRESS)}</div>
    <div>${escapeHtml(FOOTER_CONTACT)}</div>
  </div>
</body>
</html>`;
}
