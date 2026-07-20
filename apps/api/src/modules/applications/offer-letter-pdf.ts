/**
 * PDFKit-based offer letter generator. Produces a sample PDF with Lorem Ipsum content.
 * Used for contract and invoice offer letter downloads and signing envelopes.
 *
 * Envelope signing generates one signature block per signatory; coordinates are returned
 * alongside the PDF so SigningCloud signsets match the rendered layout.
 */

import PDFDocument from "pdfkit";

type PDFDoc = InstanceType<typeof PDFDocument>;

const MARGIN = 50;
const BODY_SIZE = 10;
const HEADING_SIZE = 11;
const TITLE_SIZE = 16;
const PAGE_HEIGHT_PT = 841.89;

/** Signature rectangle — aligned with SigningCloud offer-letter upload defaults. */
export const OFFER_LETTER_SIGN_FIELD = {
  left: 140,
  width: 100,
  height: 30,
} as const;

const SIGNATORY_BLOCK_HEIGHT_PT = 78;

const SAMPLE_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

const FORMAL_INTRO =
  "We are pleased to set out below the principal commercial terms of our offer. This letter is an indicative summary only. Any financing will be subject to the execution of definitive documentation, to mutual satisfaction and in the form to be provided in due course.";

const PLACEHOLDER_INSTITUTION = "[Financial institution name]";
const PLACEHOLDER_ADDRESSEE = "[Addressee name]";

export type OfferLetterSignatory = {
  name: string;
  email?: string;
};

export type SigningCloudSignField = {
  fieldtype: "sign";
  top: number;
  left: number;
  height: number;
  width: number;
  pageindex: number;
};

export type GeneratedOfferLetterResult = {
  pdfBuffer: Buffer;
  /** One SigningCloud signset per signatory, in signing order. */
  signsets: SigningCloudSignField[][];
};

type SignatureLayoutContext = {
  signsets: SigningCloudSignField[][];
  getPageIndex: () => number;
};

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

function ensureSignatureBlockFits(doc: PDFDoc): void {
  if (doc.y + SIGNATORY_BLOCK_HEIGHT_PT <= PAGE_HEIGHT_PT - MARGIN) return;
  doc.addPage();
}

function drawSignatureBlocks(
  doc: PDFDoc,
  signatories: OfferLetterSignatory[],
  layout?: SignatureLayoutContext
): void {
  const signers =
    signatories.length > 0
      ? signatories
      : [{ name: "_______________________________" }];

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(BODY_SIZE).text("Yours faithfully,");
  doc.moveDown(1.25);
  doc.font("Helvetica-Bold").text("For and on behalf of");
  doc.font("Helvetica").text(PLACEHOLDER_INSTITUTION);
  doc.moveDown(1.25);
  doc.text(
    signers.length === 1
      ? "Please sign in the place indicated below to acknowledge receipt of this letter."
      : "Please sign in the places indicated below to acknowledge receipt of this letter."
  );
  doc.moveDown(0.75);

  signers.forEach((signatory, index) => {
    if (layout) ensureSignatureBlockFits(doc);

    const heading =
      signers.length === 1 ? "Authorised signatory" : `Authorised signatory ${index + 1}`;
    doc.font("Helvetica-Bold").fontSize(BODY_SIZE).text(heading);
    doc.font("Helvetica").text(`Name: ${signatory.name.trim() || "_______________________________"}`);
    doc.moveDown(0.25);

    const fieldTop = Math.round(doc.y);
    if (layout) {
      layout.signsets.push([
        {
          fieldtype: "sign",
          top: fieldTop,
          left: OFFER_LETTER_SIGN_FIELD.left,
          height: OFFER_LETTER_SIGN_FIELD.height,
          width: OFFER_LETTER_SIGN_FIELD.width,
          pageindex: layout.getPageIndex(),
        },
      ]);
    }

    doc.moveDown(1.6);
    doc.text("Date: ____________");
    doc.moveDown(0.85);
  });
}

export type ContractOfferDetails = {
  requested_facility?: number;
  offered_facility?: number;
  facility_fee_rate_percent?: number;
  expires_at?: string;
};

export type InvoiceOfferDetails = {
  requested_amount?: number;
  offered_amount?: number;
  offered_ratio_percent?: number;
  offered_profit_rate_percent?: number;
  /** Percent of funded amount withheld as platform fee at disbursement. */
  platform_fee_rate_percent?: number;
  facility_fee_rate_percent?: number;
  facility_fee_cap_amount?: number;
  expires_at?: string;
};

export type OfferLetterTerm = {
  label: string;
  value: string;
};

function formatAmount(value: number | undefined): string {
  if (value == null) return "—";
  return `RM ${Number(value).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
}

function formatPercent(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}%`;
}

export function buildInvoiceOfferLetterTerms(
  invoiceId: string,
  offer: InvoiceOfferDetails
): OfferLetterTerm[] {
  const platformFeePct =
    offer.platform_fee_rate_percent != null && Number.isFinite(offer.platform_fee_rate_percent)
      ? offer.platform_fee_rate_percent
      : 0;
  const facilityFeeTerms =
    offer.facility_fee_rate_percent != null && offer.facility_fee_rate_percent > 0
      ? [
          {
            label: "Facility fee rate",
            value: `${formatPercent(offer.facility_fee_rate_percent)} of each disbursed invoice financing amount`,
          },
          {
            label: "Facility fee cap",
            value: formatAmount(offer.facility_fee_cap_amount),
          },
          {
            label: "Facility fee collection",
            value:
              "Deducted from issuer disbursement progressively when invoice financing is disbursed, subject to the facility fee cap",
          },
        ]
      : [];

  return [
    { label: "Our reference (invoice ID)", value: invoiceId },
    { label: "Requested amount", value: formatAmount(offer.requested_amount) },
    { label: "Proposed financing amount", value: formatAmount(offer.offered_amount) },
    { label: "Proposed financing ratio", value: `${offer.offered_ratio_percent ?? "—"}%` },
    {
      label: "Proposed profit rate (per annum)",
      value: `${offer.offered_profit_rate_percent ?? "—"}%`,
    },
    {
      label: "Platform fee (at disbursement)",
      value: `${platformFeePct}% of the funded amount, deducted from disbursement proceeds`,
    },
    ...facilityFeeTerms,
  ];
}

function createTrackedOfferLetterDoc(): { doc: PDFDoc; getPageIndex: () => number } {
  let pageIndex = 1;
  const doc = new PDFDocument({ margin: MARGIN });
  doc.on("pageAdded", () => {
    pageIndex += 1;
  });
  return { doc, getPageIndex: () => pageIndex };
}

async function pdfBufferFromDoc(doc: PDFDoc): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Build a PDF document for a contract offer letter. Writes to the provided doc stream.
 */
export function buildContractOfferLetterPdf(
  doc: PDFDoc,
  contractId: string,
  offer: ContractOfferDetails,
  signatories: OfferLetterSignatory[] = [],
  layout?: SignatureLayoutContext
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
  if (offer.facility_fee_rate_percent != null && offer.facility_fee_rate_percent > 0) {
    const cap =
      offer.offered_facility != null
        ? offer.offered_facility * (offer.facility_fee_rate_percent / 100)
        : undefined;
    termLine(doc, "Facility fee rate", formatPercent(offer.facility_fee_rate_percent));
    termLine(doc, "Facility fee cap", formatAmount(cap));
    termLine(
      doc,
      "Facility fee collection",
      "Deducted from issuer disbursement progressively when invoice financing is disbursed"
    );
  }
  sectionHeading(doc, "General");
  bodyParagraphs(doc);
  drawSignatureBlocks(doc, signatories, layout);
}

/**
 * Build a PDF document for an invoice offer letter. Writes to the provided doc stream.
 */
export function buildInvoiceOfferLetterPdf(
  doc: PDFDoc,
  invoiceId: string,
  offer: InvoiceOfferDetails,
  signatories: OfferLetterSignatory[] = [],
  layout?: SignatureLayoutContext
): void {
  formalOpen(
    doc,
    "LETTER OF OFFER — INVOICE FINANCING",
    "Indicative offer of financing against the invoice identified below"
  );
  sectionHeading(doc, "Particulars of the proposed facility");
  for (const term of buildInvoiceOfferLetterTerms(invoiceId, offer)) {
    termLine(doc, term.label, term.value);
  }
  sectionHeading(doc, "General");
  bodyParagraphs(doc);
  drawSignatureBlocks(doc, signatories, layout);
}

export async function generateContractOfferLetterBuffer(
  contractId: string,
  offer: ContractOfferDetails,
  signatories: OfferLetterSignatory[]
): Promise<GeneratedOfferLetterResult> {
  const tracked = createTrackedOfferLetterDoc();
  const layout: SignatureLayoutContext = {
    signsets: [],
    getPageIndex: tracked.getPageIndex,
  };
  buildContractOfferLetterPdf(tracked.doc, contractId, offer, signatories, layout);
  const pdfBuffer = await pdfBufferFromDoc(tracked.doc);
  return { pdfBuffer, signsets: layout.signsets };
}

export async function generateInvoiceOfferLetterBuffer(
  invoiceId: string,
  offer: InvoiceOfferDetails,
  signatories: OfferLetterSignatory[]
): Promise<GeneratedOfferLetterResult> {
  const tracked = createTrackedOfferLetterDoc();
  const layout: SignatureLayoutContext = {
    signsets: [],
    getPageIndex: tracked.getPageIndex,
  };
  buildInvoiceOfferLetterPdf(tracked.doc, invoiceId, offer, signatories, layout);
  const pdfBuffer = await pdfBufferFromDoc(tracked.doc);
  return { pdfBuffer, signsets: layout.signsets };
}

const GUARANTOR_PLACEHOLDER_BODY =
  "This is a placeholder guarantor agreement document. The final agreement text and commercial terms will be provided in a later release. By signing below, each signatory acknowledges receipt of this placeholder for signing workflow testing.";

export function buildGuarantorAgreementPlaceholderPdf(
  doc: PDFDoc,
  signatories: OfferLetterSignatory[] = [],
  layout?: SignatureLayoutContext
): void {
  formalOpen(
    doc,
    "GUARANTOR AGREEMENT",
    "Placeholder agreement for guarantor obligations in respect of the financing facility"
  );
  sectionHeading(doc, "Placeholder terms");
  doc.font("Helvetica").fontSize(BODY_SIZE).text(GUARANTOR_PLACEHOLDER_BODY, { align: "justify" });
  doc.moveDown(0.5);
  bodyParagraphs(doc);
  drawSignatureBlocks(doc, signatories, layout);
}

export async function generateGuarantorAgreementPlaceholderBuffer(
  signatories: OfferLetterSignatory[]
): Promise<GeneratedOfferLetterResult> {
  const tracked = createTrackedOfferLetterDoc();
  const layout: SignatureLayoutContext = {
    signsets: [],
    getPageIndex: tracked.getPageIndex,
  };
  buildGuarantorAgreementPlaceholderPdf(tracked.doc, signatories, layout);
  const pdfBuffer = await pdfBufferFromDoc(tracked.doc);
  return { pdfBuffer, signsets: layout.signsets };
}

/**
 * Generate a contract offer letter PDF as a stream. Caller pipes to response.
 */
export function generateContractOfferLetterStream(
  contractId: string,
  offer: ContractOfferDetails
): PDFDoc {
  const doc = new PDFDocument({ margin: MARGIN });
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
  const doc = new PDFDocument({ margin: MARGIN });
  buildInvoiceOfferLetterPdf(doc, invoiceId, offer);
  doc.end();
  return doc;
}
