/**
 * PDFKit-based offer letter generator. Produces a sample PDF with Lorem Ipsum content.
 * Used for contract and invoice offer letter downloads.
 */

import PDFDocument from "pdfkit";

type PDFDoc = InstanceType<typeof PDFDocument>;

const MARGIN = 50;
const BODY_SIZE = 10;
const HEADING_SIZE = 11;
const TITLE_SIZE = 16;

const SAMPLE_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

const FORMAL_INTRO =
  "We are pleased to set out below the principal commercial terms of our offer. This letter is an indicative summary only. Any financing will be subject to the execution of definitive documentation, to mutual satisfaction and in the form to be provided in due course.";

const PLACEHOLDER_INSTITUTION = "[Financial institution name]";
const PLACEHOLDER_ADDRESSEE = "[Addressee name]";

function drawTitleRule(doc: PDFDoc): void {
  doc.moveDown(0.2);
  const y = doc.y;
  const rightX = doc.page.width - MARGIN;
  doc.moveTo(MARGIN, y).lineTo(rightX, y).lineWidth(0.5).strokeColor("#333333").stroke();
  doc.moveDown(0.6);
}

function formalOpen(doc: PDFDoc, documentTitle: string, referenceLine: string): void {
  doc.font("Helvetica-Bold").fontSize(TITLE_SIZE).text(documentTitle, { align: "center" });
  doc.moveDown(0.35);
  drawTitleRule(doc);
  doc.font("Helvetica").fontSize(BODY_SIZE).fillColor("black");
  doc.text("Date: [Date of issue]");
  doc.moveDown(0.4);
  doc.text(PLACEHOLDER_ADDRESSEE);
  doc.moveDown(0.45);
  doc.font("Helvetica-Bold").text(`Re: ${referenceLine}`);
  doc.moveDown(0.5);
  doc.font("Helvetica").text("Dear Sir/Madam,");
  doc.moveDown(0.5);
  doc.text(FORMAL_INTRO, { align: "justify" });
  doc.moveDown(0.65);
}

function sectionHeading(doc: PDFDoc, title: string): void {
  doc.moveDown(0.25);
  doc.font("Helvetica-Bold").fontSize(HEADING_SIZE).fillColor("black").text(title);
  doc.moveDown(0.35);
}

function termLine(doc: PDFDoc, label: string, value: string): void {
  doc.font("Helvetica-Bold").fontSize(BODY_SIZE);
  doc.text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value);
  doc.moveDown(0.12);
}

function bodyParagraphs(doc: PDFDoc): void {
  doc.font("Helvetica").fontSize(BODY_SIZE);
  doc.text(SAMPLE_TEXT, { align: "justify" });
  doc.moveDown(0.5);
  doc.text(SAMPLE_TEXT, { align: "justify" });
}

function signatureBlock(doc: PDFDoc): void {
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(BODY_SIZE).text("Yours faithfully,");
  doc.moveDown(1.25);
  doc.font("Helvetica-Bold").text("For and on behalf of");
  doc.font("Helvetica").text(PLACEHOLDER_INSTITUTION);
  doc.moveDown(1.25);
  doc.text("Please sign in the place indicated below to acknowledge receipt of this letter.");
  doc.moveDown(0.75);
  doc.text("Authorised signatory");
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor("white").text("\\s1\\", { lineGap: 50 });
  doc
    .fillColor("black")
    .fontSize(BODY_SIZE)
    .text("Printed name: _________________________________    Date: ____________");
}

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
  formalOpen(
    doc,
    "LETTER OF OFFER — CONTRACT FINANCING",
    "Indicative facility offer in respect of the contract identified below"
  );
  sectionHeading(doc, "Particulars of the proposed facility");
  termLine(doc, "Our reference (contract ID)", contractId);
  termLine(doc, "Requested facility", formatAmount(offer.requested_facility));
  termLine(doc, "Proposed offered facility", formatAmount(offer.offered_facility));
  termLine(doc, "This offer expires on", formatDate(offer.expires_at));
  sectionHeading(doc, "General");
  bodyParagraphs(doc);
  signatureBlock(doc);
}

/**
 * Build a PDF document for an invoice offer letter. Writes to the provided doc stream.
 */
export function buildInvoiceOfferLetterPdf(
  doc: PDFDoc,
  invoiceId: string,
  offer: InvoiceOfferDetails
): void {
  formalOpen(
    doc,
    "LETTER OF OFFER — INVOICE FINANCING",
    "Indicative offer of financing against the invoice identified below"
  );
  sectionHeading(doc, "Particulars of the proposed facility");
  termLine(doc, "Our reference (invoice ID)", invoiceId);
  termLine(doc, "Requested amount", formatAmount(offer.requested_amount));
  termLine(doc, "Proposed financing amount", formatAmount(offer.offered_amount));
  termLine(doc, "Proposed financing ratio", `${offer.offered_ratio_percent ?? "—"}%`);
  termLine(doc, "Proposed profit rate (per annum)", `${offer.offered_profit_rate_percent ?? "—"}%`);
  termLine(doc, "This offer expires on", formatDate(offer.expires_at));
  sectionHeading(doc, "General");
  bodyParagraphs(doc);
  signatureBlock(doc);
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
