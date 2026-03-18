/**
 * PDFKit-based offer letter generator. Produces a sample PDF with Lorem Ipsum content.
 * Used for contract and invoice offer letter downloads.
 */

import PDFDocument from "pdfkit";

type PDFDoc = InstanceType<typeof PDFDocument>;

const SAMPLE_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

export type ContractOfferDetails = {
  requested_facility?: number;
  offered_facility?: number;
  expires_at?: string;
};

export type InvoiceOfferDetails = {
  requested_amount?: number;
  offered_amount?: number;
  offered_ratio_percent?: number;
  offered_profit_rate_percent?: number;
  expires_at?: string;
};

function formatAmount(value: number | undefined): string {
  if (value == null) return "—";
  return `RM ${Number(value).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

/**
 * Build a PDF document for a contract offer letter. Writes to the provided doc stream.
 */
export function buildContractOfferLetterPdf(
  doc: PDFDoc,
  contractId: string,
  offer: ContractOfferDetails
): void {
  doc.fontSize(18).text("Contract Financing Offer Letter", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Contract ID: ${contractId}`, { continued: false });
  doc.moveDown(0.5);
  doc.text(`Requested facility: ${formatAmount(offer.requested_facility)}`);
  doc.text(`Offered facility: ${formatAmount(offer.offered_facility)}`);
  doc.text(`Expires: ${formatDate(offer.expires_at)}`);
  doc.moveDown();
  doc.fontSize(10).text(SAMPLE_TEXT);
  doc.moveDown();
  doc.text(SAMPLE_TEXT);
}

/**
 * Build a PDF document for an invoice offer letter. Writes to the provided doc stream.
 */
export function buildInvoiceOfferLetterPdf(
  doc: PDFDoc,
  invoiceId: string,
  offer: InvoiceOfferDetails
): void {
  doc.fontSize(18).text("Invoice Financing Offer Letter", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice ID: ${invoiceId}`, { continued: false });
  doc.moveDown(0.5);
  doc.text(`Requested amount: ${formatAmount(offer.requested_amount)}`);
  doc.text(`Financing Amount: ${formatAmount(offer.offered_amount)}`);
  doc.text(`Financing Ratio: ${offer.offered_ratio_percent ?? "—"}%`);
  doc.text(`Profit rate: ${offer.offered_profit_rate_percent ?? "—"}%`);
  doc.text(`Expires: ${formatDate(offer.expires_at)}`);
  doc.moveDown();
  doc.fontSize(10).text(SAMPLE_TEXT);
  doc.moveDown();
  doc.text(SAMPLE_TEXT);
}

/**
 * Generate a contract offer letter PDF as a stream. Caller pipes to response.
 */
export function generateContractOfferLetterStream(
  contractId: string,
  offer: ContractOfferDetails
): PDFDoc {
  const doc = new PDFDocument({ margin: 50 });
  buildContractOfferLetterPdf(doc, contractId, offer);
  doc.end();
  return doc;
}

/**
 * Generate an invoice offer letter PDF as a stream. Caller pipes to response.
 */
export function generateInvoiceOfferLetterStream(
  invoiceId: string,
  offer: InvoiceOfferDetails
): PDFDoc {
  const doc = new PDFDocument({ margin: 50 });
  buildInvoiceOfferLetterPdf(doc, invoiceId, offer);
  doc.end();
  return doc;
}
