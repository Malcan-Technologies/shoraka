/**
 * SECTION: Payment receipt HTML template (PDF)
 * WHY: Visual presentation only — Playwright embeds this HTML; logo must be a data URI.
 */

import {
  getProspectusOfficialLogoDataUri,
} from "../../notes/prospectus/prospectus-header-logo";
import type { ReceiptMerchantDetails } from "./receipt-merchant-config";

export type ReceiptPdfTemplateData = {
  receiptNumber: string;
  receiptDateLabel: string;
  merchant: ReceiptMerchantDetails;
  payerName: string | null;
  payerCompanyName: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  purposeLabel: string;
  amountLabel: string;
  currency: string;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentDateLabel: string;
  curlecPaymentId: string | null;
  curlecOrderId: string;
  relatedReferenceLabel: string | null;
  relatedReference: string | null;
  walletCreditStatus: string | null;
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

export function buildPaymentReceiptHtml(data: ReceiptPdfTemplateData): string {
  const merchantExtra = [
    data.merchant.registrationNumber
      ? `SSM / Co. Reg: ${data.merchant.registrationNumber}`
      : null,
    data.merchant.licenceNumber ? `Licence: ${data.merchant.licenceNumber}` : null,
    data.merchant.address,
    data.merchant.telephone ? `Tel: ${data.merchant.telephone}` : null,
    data.merchant.email ? `Email: ${data.merchant.email}` : null,
  ]
    .filter(Boolean)
    .map((line) => `<div class="merchant-line">${escapeHtml(line as string)}</div>`)
    .join("");

  const receivedFrom = [
    row("Name", data.payerName),
    row("Company", data.payerCompanyName),
    row("Email", data.payerEmail),
    row("Phone", data.payerPhone),
  ].join("");

  const paymentRows = [
    row("Purpose of Payment", data.purposeLabel),
    row("Amount Paid", data.amountLabel),
    row("Currency", data.currency),
    row("Payment Method", data.paymentMethod),
    row("Payment Status", data.paymentStatus),
    row("Payment Date and Time", data.paymentDateLabel),
    row("Curlec Payment ID", data.curlecPaymentId),
    row("Curlec Order ID", data.curlecOrderId),
    data.relatedReferenceLabel && data.relatedReference
      ? row(data.relatedReferenceLabel, data.relatedReference)
      : "",
    data.walletCreditStatus ? row("Wallet Credit Status", data.walletCreditStatus) : "",
  ].join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Payment Receipt ${escapeHtml(data.receiptNumber)}</title>
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

    .page {
      max-width: 100%;
    }

    .accent-bar {
      height: 5px;
      background: linear-gradient(90deg, #8A0304 0%, #CE2922 55%, #BAA38B 100%);
      margin: 0 0 22px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 28px;
      margin-bottom: 22px;
    }

    .brand-block {
      flex: 1 1 auto;
      min-width: 0;
    }

    .brand-logo {
      display: block;
      width: ${LOGO_WIDTH_PX}px;
      height: ${LOGO_HEIGHT_PX}px;
      object-fit: contain;
      object-position: left center;
      margin: 0 0 12px;
    }

    .brand-wordmark {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #8A0304;
      margin: 0 0 10px;
    }

    .merchant-legal {
      font-size: 12.5px;
      font-weight: 700;
      color: #18181b;
      margin: 0 0 4px;
    }

    .merchant-line {
      font-size: 10.5px;
      color: #52525b;
      line-height: 1.5;
    }

    .title-card {
      flex: 0 0 240px;
      width: 240px;
      border: 1px solid #e4e4e7;
      border-top: 3px solid #8A0304;
      background: #fafafa;
      padding: 14px 16px;
      text-align: right;
    }

    .title-card h1 {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #8A0304;
      line-height: 1.2;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 6px;
      font-size: 10.5px;
    }

    .meta-row .label {
      color: #71717a;
      font-weight: 600;
      text-align: left;
      white-space: nowrap;
    }

    .meta-row .value {
      color: #18181b;
      font-weight: 600;
      text-align: right;
      word-break: break-word;
    }

    .section {
      margin-top: 20px;
      border: 1px solid #e4e4e7;
      border-radius: 4px;
      overflow: hidden;
    }

    .section-head {
      margin: 0;
      padding: 9px 14px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6F4924;
      background: #f8f5f1;
      border-bottom: 1px solid #e8e0d6;
    }

    .section-body {
      padding: 4px 14px 8px;
    }

    table.kv {
      width: 100%;
      border-collapse: collapse;
    }

    table.kv th,
    table.kv td {
      padding: 8px 0;
      vertical-align: top;
      text-align: left;
      border-bottom: 1px solid #f4f4f5;
    }

    table.kv tr:last-child th,
    table.kv tr:last-child td {
      border-bottom: none;
    }

    table.kv th {
      width: 38%;
      color: #71717a;
      font-weight: 600;
      padding-right: 16px;
    }

    table.kv td {
      color: #18181b;
      font-weight: 500;
      word-break: break-word;
    }

    .empty-note {
      padding: 10px 0;
      color: #a1a1aa;
      font-style: italic;
    }

    .total {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 16px 18px;
      background: linear-gradient(90deg, #f8f5f1 0%, #fafafa 100%);
      border: 1px solid #e8e0d6;
      border-left: 5px solid #8A0304;
      border-radius: 4px;
    }

    .total .label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #6F4924;
    }

    .total .value {
      font-size: 22px;
      font-weight: 700;
      color: #8A0304;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    .footer {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid #e4e4e7;
      font-size: 10px;
      color: #a1a1aa;
      text-align: center;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="accent-bar"></div>

    <div class="header">
      <div class="brand-block">
        ${buildBrandMarkHtml()}
        <div class="merchant-legal">${escapeHtml(data.merchant.legalName)}</div>
        ${merchantExtra}
      </div>
      <div class="title-card">
        <h1>PAYMENT RECEIPT</h1>
        <div class="meta-row">
          <span class="label">Receipt No.</span>
          <span class="value">${escapeHtml(data.receiptNumber)}</span>
        </div>
        <div class="meta-row">
          <span class="label">Receipt Date</span>
          <span class="value">${escapeHtml(data.receiptDateLabel)}</span>
        </div>
      </div>
    </div>

    <section class="section">
      <h2 class="section-head">Received From</h2>
      <div class="section-body">
        ${
          receivedFrom
            ? `<table class="kv">${receivedFrom}</table>`
            : `<div class="empty-note">—</div>`
        }
      </div>
    </section>

    <section class="section">
      <h2 class="section-head">Payment Details</h2>
      <div class="section-body">
        <table class="kv">${paymentRows}</table>
      </div>
    </section>

    <div class="total">
      <div class="label">TOTAL PAID</div>
      <div class="value">${escapeHtml(data.amountLabel)}</div>
    </div>

    <div class="footer">This is a computer-generated receipt. No signature is required.</div>
  </div>
</body>
</html>`;
}
