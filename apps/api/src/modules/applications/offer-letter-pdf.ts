/**
 * PDFKit-based offer letter generator.
 * Facility and invoice-only letters still use placeholder General copy.
 * Facility-linked utilisation downloads use the shared utilisation terms.
 *
 * Envelope signing generates one signature block per signatory; coordinates are returned
 * alongside the PDF so SigningCloud signsets match the rendered layout.
 */

import PDFDocument from "pdfkit";
import {
  computeFacilityFeeTotalOwed,
  computeIndicativeAmountPayable,
  computeIndicativeUtilisationProfit,
  hasInvoiceFeeSchedule,
  parseFiniteNumber,
  parseInvoiceFeeSchedule,
  roundNoteMoney,
  UTILISATION_FULL_AUTHORISATION_CLAUSES,
  UTILISATION_FULL_AUTHORISATION_INTRO,
  UTILISATION_FULL_AUTHORISATION_TITLE,
  UTILISATION_OFFER_BINDING_FOOTER,
  UTILISATION_OFFER_CONSENTS,
  UTILISATION_OFFER_CONSENTS_LETTER_INTRO,
  UTILISATION_OFFER_CONSENTS_TITLE,
  UTILISATION_OFFER_LETTER_CLOSE,
  UTILISATION_OFFER_TERM_CLAUSES,
  UTILISATION_OFFER_TERMS_INTRO,
  UTILISATION_OFFER_TERMS_TITLE,
  type AdditionalFeeLine,
} from "@cashsouk/types";
import { resolveOfferedPlatformFeeRatePercent } from "../../lib/invoice-offer";

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

function formalOpen(
  doc: PDFDoc,
  documentTitle: string,
  referenceLine: string,
  intro: string = FORMAL_INTRO
): void {
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
  doc.text(intro, { align: "justify" });
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

function utilisationTermsParagraphs(doc: PDFDoc): void {
  for (const clause of UTILISATION_OFFER_TERM_CLAUSES) {
    doc.font("Helvetica-Bold").fontSize(BODY_SIZE).text(clause.title);
    doc.font("Helvetica").text(clause.body, { align: "justify" });
    doc.moveDown(0.35);
  }
  doc.font("Helvetica-Bold").text(UTILISATION_OFFER_CONSENTS_TITLE);
  doc.font("Helvetica").text(UTILISATION_OFFER_CONSENTS_LETTER_INTRO, { align: "justify" });
  doc.moveDown(0.35);
  for (const consent of UTILISATION_OFFER_CONSENTS) {
    doc.font("Helvetica-Bold").text(consent.title, { align: "justify" });
    doc.font("Helvetica").text(consent.detail, { align: "justify" });
    doc.moveDown(0.3);
  }
  doc.font("Helvetica").text(UTILISATION_OFFER_BINDING_FOOTER, { align: "justify" });
  doc.moveDown(0.45);
  doc.font("Helvetica-Bold").text(UTILISATION_FULL_AUTHORISATION_TITLE);
  doc.font("Helvetica").text(UTILISATION_FULL_AUTHORISATION_INTRO, { align: "justify" });
  doc.moveDown(0.35);
  UTILISATION_FULL_AUTHORISATION_CLAUSES.forEach((clause, index) => {
    doc.font("Helvetica-Bold").text(`${index + 1}. ${clause.title}`);
    for (const paragraph of clause.paragraphs) {
      doc.font("Helvetica").text(paragraph, { align: "justify" });
    }
    doc.moveDown(0.3);
  });
}

function ensureSignatureBlockFits(doc: PDFDoc): void {
  if (doc.y + SIGNATORY_BLOCK_HEIGHT_PT <= PAGE_HEIGHT_PT - MARGIN) return;
  doc.addPage();
}

function drawUtilisationAcceptanceClose(doc: PDFDoc): void {
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(BODY_SIZE).text(UTILISATION_OFFER_LETTER_CLOSE, { align: "justify" });
  doc.moveDown(0.75);
  doc.text("Yours faithfully,");
  doc.moveDown(1.25);
  doc.font("Helvetica-Bold").text("For and on behalf of");
  doc.font("Helvetica").text(PLACEHOLDER_INSTITUTION);
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
  facility_fee_upfront_collect_amount?: number;
  expires_at?: string;
};

export type InvoiceOfferLetterKind = "invoice" | "utilisation";

export function invoiceOfferLetterKindForContract(
  contractId: string | null | undefined
): InvoiceOfferLetterKind {
  return contractId ? "utilisation" : "invoice";
}

export function invoiceOfferLetterPresentation(kind: InvoiceOfferLetterKind): {
  title: string;
  subtitle: string;
  intro: string;
  termsSection: string;
  particularsSection: string;
  includeSignatureBlocks: boolean;
} {
  if (kind === "utilisation") {
    return {
      title: "UTILISATION OFFER — INVOICE FINANCING",
      subtitle: "Utilisation of your existing approved facility against the invoice identified below",
      intro: UTILISATION_OFFER_TERMS_INTRO,
      particularsSection: "Particulars of this utilisation",
      termsSection: UTILISATION_OFFER_TERMS_TITLE,
      includeSignatureBlocks: false,
    };
  }
  return {
    title: "LETTER OF OFFER — INVOICE FINANCING",
    subtitle: "Indicative offer of financing against the invoice identified below",
    intro: FORMAL_INTRO,
    particularsSection: "Particulars of the proposed facility",
    termsSection: "General",
    includeSignatureBlocks: true,
  };
}

export type InvoiceOfferDetails = {
  requested_amount?: number;
  offered_amount?: number;
  offered_ratio_percent?: number;
  offered_profit_rate_percent?: number;
  financing_tenure_days?: number;
  risk_rating?: string;
  /** Stored API name `platform_fee_rate_percent`; user-visible label is Drawdown fee. */
  platform_fee_rate_percent?: number;
  facility_fee_rate_percent?: number;
  facility_fee_cap_amount?: number;
  fee_schedule_version?: number;
  facility_fee_collect_amount?: number;
  additional_fees?: AdditionalFeeLine[];
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

const CHARGED_ON_SUCCESSFUL_FUNDING = "Charged only if funding succeeds.";

function drawdownFeeTerm(ratePercent: number): OfferLetterTerm {
  return {
    label: "Drawdown fee",
    value: `${formatPercent(ratePercent)} of the actual funded amount. ${CHARGED_ON_SUCCESSFUL_FUNDING}`,
  };
}

function additionalFeeTerm(line: AdditionalFeeLine): OfferLetterTerm {
  const basis =
    line.kind === "percent_of_funded"
      ? `${formatPercent(line.value)} of the actual funded amount`
      : `${formatAmount(line.value)} (fixed)`;
  return {
    label: line.name,
    value: `${basis}. ${CHARGED_ON_SUCCESSFUL_FUNDING}`,
  };
}

function facilityFeeUpfrontTerms(total: number | undefined, offer: ContractOfferDetails): OfferLetterTerm[] {
  const rawUpfront = Math.max(0, parseFiniteNumber(offer.facility_fee_upfront_collect_amount) ?? 0);
  const upfrontAmount =
    total != null ? roundNoteMoney(Math.min(rawUpfront, total)) : roundNoteMoney(rawUpfront);
  const remaining =
    total != null ? roundNoteMoney(Math.max(0, total - upfrontAmount)) : undefined;
  if (upfrontAmount <= 0) {
    return [
      {
        label: "Upfront facility fee",
        value: "No upfront gateway payment is required.",
      },
      {
        label: "Remaining facility fee",
        value:
          remaining == null
            ? "Any remaining facility fee is intended for collection from later invoice drawdowns."
            : `${formatAmount(remaining)} is intended for collection from later invoice drawdowns.`,
      },
    ];
  }
  return [
    {
      label: "Upfront facility fee",
      value: `${formatAmount(upfrontAmount)} is payable by gateway after you accept this facility offer.`,
    },
    {
      label: "Remaining facility fee",
      value:
        remaining == null
          ? "Any remaining facility fee is intended for collection from later invoice drawdowns."
          : `${formatAmount(remaining)} is intended for collection from later invoice drawdowns.`,
    },
  ];
}

export function buildContractOfferLetterTerms(
  cashSoukReference: string | null | undefined,
  offer: ContractOfferDetails
): OfferLetterTerm[] {
  const rate =
    offer.facility_fee_rate_percent != null && Number.isFinite(offer.facility_fee_rate_percent)
      ? offer.facility_fee_rate_percent
      : 0;
  const total =
    offer.offered_facility != null && Number.isFinite(offer.offered_facility)
      ? computeFacilityFeeTotalOwed(offer.offered_facility, rate)
      : undefined;
  return [
    { label: "CashSouk Reference", value: cashSoukReference?.trim() || "—" },
    { label: "Requested facility", value: formatAmount(offer.requested_facility) },
    { label: "Proposed offered facility", value: formatAmount(offer.offered_facility) },
    { label: "Facility fee rate", value: formatPercent(rate) },
    { label: "Facility fee total", value: formatAmount(total) },
    ...facilityFeeUpfrontTerms(total, offer),
  ];
}

/**
 * Map stored invoice offer_details (plus optional contract details for grandfather
 * offers) into the PDF DTO. Versioned schedules are taken from the offer; they are
 * never rebuilt as progressive facility-fee terms.
 */
export function buildInvoiceOfferLetterDto(
  offer: Record<string, unknown>,
  contractDetails?: Record<string, unknown> | null
): InvoiceOfferDetails {
  const dto: InvoiceOfferDetails = {
    requested_amount: parseFiniteNumber(offer.requested_amount),
    offered_amount: parseFiniteNumber(offer.offered_amount),
    offered_ratio_percent: parseFiniteNumber(offer.offered_ratio_percent),
    offered_profit_rate_percent: parseFiniteNumber(offer.offered_profit_rate_percent),
    financing_tenure_days: parseFiniteNumber(offer.financing_tenure_days) ?? undefined,
    risk_rating: typeof offer.risk_rating === "string" ? offer.risk_rating : undefined,
    platform_fee_rate_percent: resolveOfferedPlatformFeeRatePercent(offer),
  };
  const schedule = parseInvoiceFeeSchedule(offer);
  if (schedule) {
    dto.fee_schedule_version = schedule.version;
    dto.facility_fee_collect_amount = schedule.facilityFeeCollectAmount;
    dto.additional_fees = schedule.additionalFees;
    return dto;
  }
  if (contractDetails) {
    const rate = parseFiniteNumber(contractDetails.facility_fee_rate_percent);
    const approvedFacility = parseFiniteNumber(contractDetails.approved_facility);
    if (rate != null && rate >= 0) {
      dto.facility_fee_rate_percent = rate;
      if (approvedFacility != null && approvedFacility > 0) {
        dto.facility_fee_cap_amount = computeFacilityFeeTotalOwed(approvedFacility, rate);
      }
    }
  }
  return dto;
}

export function buildInvoiceOfferLetterTerms(
  cashSoukReference: string | null | undefined,
  offer: InvoiceOfferDetails
): OfferLetterTerm[] {
  const platformFeePct =
    offer.platform_fee_rate_percent != null && Number.isFinite(offer.platform_fee_rate_percent)
      ? offer.platform_fee_rate_percent
      : 0;
  const indicativeProfit = computeIndicativeUtilisationProfit({
    offeredAmount: offer.offered_amount,
    profitRatePercent: offer.offered_profit_rate_percent,
    tenureDays: offer.financing_tenure_days,
  });
  const indicativePayable = computeIndicativeAmountPayable(offer.offered_amount, indicativeProfit);
  const base: OfferLetterTerm[] = [
    { label: "CashSouk Reference", value: cashSoukReference?.trim() || "—" },
    { label: "Requested amount", value: formatAmount(offer.requested_amount) },
    { label: "Proposed financing amount", value: formatAmount(offer.offered_amount) },
    { label: "Financing margin", value: `${offer.offered_ratio_percent ?? "—"}%` },
    {
      label: "Proposed profit rate (per annum)",
      value: `${offer.offered_profit_rate_percent ?? "—"}%`,
    },
    ...(offer.risk_rating
      ? [{ label: "Risk rating", value: offer.risk_rating }]
      : []),
    ...(offer.financing_tenure_days != null && Number.isFinite(offer.financing_tenure_days)
      ? [
          {
            label: "Financing tenure",
            value: `${offer.financing_tenure_days} days from disbursement`,
          },
        ]
      : []),
    ...(indicativeProfit != null
      ? [{ label: "Indicative profit", value: formatAmount(indicativeProfit) }]
      : []),
    ...(indicativePayable != null
      ? [{ label: "Indicative amount payable", value: formatAmount(indicativePayable) }]
      : []),
    drawdownFeeTerm(platformFeePct),
  ];

  if (hasInvoiceFeeSchedule(offer) || (offer.fee_schedule_version != null && offer.fee_schedule_version >= 1)) {
    const collect = offer.facility_fee_collect_amount ?? 0;
    const additional = offer.additional_fees ?? [];
    return [
      ...base,
      {
        label: "Facility fee collection",
        value: `${formatAmount(collect)} (exact amount on this offer). ${CHARGED_ON_SUCCESSFUL_FUNDING}`,
      },
      ...additional.map(additionalFeeTerm),
    ];
  }

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

  return [...base, ...facilityFeeTerms];
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
  cashSoukReference: string | null | undefined,
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
  for (const term of buildContractOfferLetterTerms(cashSoukReference, offer)) {
    termLine(doc, term.label, term.value);
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
  cashSoukReference: string | null | undefined,
  offer: InvoiceOfferDetails,
  signatories: OfferLetterSignatory[] = [],
  layout?: SignatureLayoutContext,
  kind: InvoiceOfferLetterKind = "invoice"
): void {
  const copy = invoiceOfferLetterPresentation(kind);
  formalOpen(doc, copy.title, copy.subtitle, copy.intro);
  sectionHeading(doc, copy.particularsSection);
  for (const term of buildInvoiceOfferLetterTerms(cashSoukReference, offer)) {
    termLine(doc, term.label, term.value);
  }
  sectionHeading(doc, copy.termsSection);
  if (kind === "utilisation") {
    utilisationTermsParagraphs(doc);
  } else {
    bodyParagraphs(doc);
  }
  if (copy.includeSignatureBlocks) {
    drawSignatureBlocks(doc, signatories, layout);
  } else {
    drawUtilisationAcceptanceClose(doc);
  }
}

export async function generateContractOfferLetterBuffer(
  cashSoukReference: string | null | undefined,
  offer: ContractOfferDetails,
  signatories: OfferLetterSignatory[]
): Promise<GeneratedOfferLetterResult> {
  const tracked = createTrackedOfferLetterDoc();
  const layout: SignatureLayoutContext = {
    signsets: [],
    getPageIndex: tracked.getPageIndex,
  };
  buildContractOfferLetterPdf(tracked.doc, cashSoukReference, offer, signatories, layout);
  const pdfBuffer = await pdfBufferFromDoc(tracked.doc);
  return { pdfBuffer, signsets: layout.signsets };
}

export async function generateInvoiceOfferLetterBuffer(
  cashSoukReference: string | null | undefined,
  offer: InvoiceOfferDetails,
  signatories: OfferLetterSignatory[],
  kind: InvoiceOfferLetterKind = "invoice"
): Promise<GeneratedOfferLetterResult> {
  const tracked = createTrackedOfferLetterDoc();
  const layout: SignatureLayoutContext = {
    signsets: [],
    getPageIndex: tracked.getPageIndex,
  };
  buildInvoiceOfferLetterPdf(tracked.doc, cashSoukReference, offer, signatories, layout, kind);
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
  cashSoukReference: string | null | undefined,
  offer: ContractOfferDetails
): PDFDoc {
  const doc = new PDFDocument({ margin: MARGIN });
  buildContractOfferLetterPdf(doc, cashSoukReference, offer);
  doc.end();
  return doc;
}

/**
 * Generate an invoice offer letter PDF as a stream. Caller pipes to response.
 */
export function generateInvoiceOfferLetterStream(
  cashSoukReference: string | null | undefined,
  offer: InvoiceOfferDetails,
  kind: InvoiceOfferLetterKind = "invoice"
): PDFDoc {
  const doc = new PDFDocument({ margin: MARGIN });
  buildInvoiceOfferLetterPdf(doc, cashSoukReference, offer, [], undefined, kind);
  doc.end();
  return doc;
}
