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
    .map((line) => `<div>${escapeHtml(line as string)}</div>`)
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
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      color: #1f2937;
      font-size: 12px;
      line-height: 1.45;
    }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
    .merchant { font-size: 11px; color: #4b5563; }
    .merchant strong { display: block; font-size: 14px; color: #111827; margin-bottom: 6px; }
    .title-block { text-align: right; }
    .title-block h1 {
      margin: 0 0 8px;
      font-size: 20px;
      letter-spacing: 0.04em;
      color: #8A0304;
    }
    .meta { font-size: 11px; color: #4b5563; }
    h2 {
      margin: 22px 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6F4924;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 0; vertical-align: top; text-align: left; }
    th { width: 38%; color: #6b7280; font-weight: 600; }
    .total {
      margin-top: 28px;
      padding: 14px 16px;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total .label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #374151;
    }
    .total .value {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }
    .footer {
      margin-top: 36px;
      font-size: 10px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="merchant">
      <strong>${escapeHtml(data.merchant.legalName)}</strong>
      ${merchantExtra}
    </div>
    <div class="title-block">
      <h1>PAYMENT RECEIPT</h1>
      <div class="meta">Receipt Number: <strong>${escapeHtml(data.receiptNumber)}</strong></div>
      <div class="meta">Receipt Date: ${escapeHtml(data.receiptDateLabel)}</div>
    </div>
  </div>

  <h2>Received From</h2>
  <table>${receivedFrom || "<tr><td colspan='2'>—</td></tr>"}</table>

  <h2>Payment Details</h2>
  <table>${paymentRows}</table>

  <div class="total">
    <div class="label">TOTAL PAID</div>
    <div class="value">${escapeHtml(data.amountLabel)}</div>
  </div>

  <div class="footer">This is a computer-generated receipt. No signature is required.</div>
</body>
</html>`;
}
