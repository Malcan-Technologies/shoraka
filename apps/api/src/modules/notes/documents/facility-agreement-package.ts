import { PDFDocument } from "pdf-lib";
import { extractPdfTextItems } from "../../applications/joint-several-guarantee/jsg-signing-placement";

export const FACILITY_AGREEMENT_PACKAGE_ASSEMBLER_VERSION = 1;

export const FA_PACKAGE_SCHEDULE_3_NEEDLE = "SCHEDULE 3 LETTER OF OFFER";
export const FA_PACKAGE_CERTIFICATE_NEEDLE = "ATTACHMENT E CERTIFICATE";

export class FaPackageAnchorError extends Error {
  readonly code = "FA_PACKAGE_ANCHORS_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "FaPackageAnchorError";
  }
}

export function normalizePdfDividerText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function pageTextByIndex(items: Array<{ pageindex: number; text: string }>): Map<number, string> {
  const pages = new Map<number, string[]>();
  for (const item of items) {
    const parts = pages.get(item.pageindex) ?? [];
    parts.push(item.text);
    pages.set(item.pageindex, parts);
  }
  const normalized = new Map<number, string>();
  for (const [pageindex, parts] of pages) {
    normalized.set(pageindex, normalizePdfDividerText(parts.join(" ")));
  }
  return normalized;
}

function uniquePageWithNeedle(
  pages: Map<number, string>,
  needle: string,
  label: string
): number {
  const matches = [...pages.entries()]
    .filter(([, text]) => text.includes(needle))
    .map(([pageindex]) => pageindex);
  if (matches.length === 0) {
    throw new FaPackageAnchorError(`The signed Facility Agreement is missing ${label}.`);
  }
  if (matches.length > 1) {
    throw new FaPackageAnchorError(
      `The signed Facility Agreement has more than one ${label} divider page.`
    );
  }
  return matches[0]!;
}

/** 1-based PDF page numbers for the unique Schedule 3 and e-Certificate dividers. */
export function findFacilityAgreementPackageAnchors(
  items: Array<{ pageindex: number; text: string }>
): { schedule3Page: number; eCertificatePage: number } {
  const pages = pageTextByIndex(items);
  const schedule3Page = uniquePageWithNeedle(
    pages,
    FA_PACKAGE_SCHEDULE_3_NEEDLE,
    "SCHEDULE 3 (LETTER OF OFFER)"
  );
  const eCertificatePage = uniquePageWithNeedle(
    pages,
    FA_PACKAGE_CERTIFICATE_NEEDLE,
    "Attachment (e-Certificate)"
  );
  if (eCertificatePage <= schedule3Page) {
    throw new FaPackageAnchorError(
      "The signed Facility Agreement divider pages are out of order."
    );
  }
  return { schedule3Page, eCertificatePage };
}

function pageRange(fromInclusive: number, toInclusive: number): number[] {
  const pages: number[] = [];
  for (let index = fromInclusive; index <= toInclusive; index += 1) {
    pages.push(index);
  }
  return pages;
}

export type ComposeFacilityAgreementPackageInput = {
  signedFaPdf: Buffer;
  letterOfOfferPdf: Buffer;
  certificatePdfs: Buffer[];
  title: string;
};

export type ComposeFacilityAgreementPackageResult = {
  bytes: Buffer;
  schedule3Page: number;
  eCertificatePage: number;
  pageCount: number;
};

export async function assembleFacilityAgreementPackagePages(input: {
  signedFaPdf: Buffer;
  letterOfOfferPdf: Buffer;
  certificatePdfs: Buffer[];
  schedule3Page: number;
  eCertificatePage: number;
  title: string;
}): Promise<Buffer> {
  const signedFa = await PDFDocument.load(new Uint8Array(input.signedFaPdf));
  const letterOfOffer = await PDFDocument.load(new Uint8Array(input.letterOfOfferPdf));
  const output = await PDFDocument.create();
  output.setTitle(input.title);
  output.setSubject("Compiled copy — not the digitally signed original");

  const schedule3Index = input.schedule3Page - 1;
  const eCertificateIndex = input.eCertificatePage - 1;
  const lastFaIndex = signedFa.getPageCount() - 1;
  if (
    schedule3Index < 0 ||
    eCertificateIndex <= schedule3Index ||
    eCertificateIndex > lastFaIndex
  ) {
    throw new FaPackageAnchorError("The signed Facility Agreement divider pages are invalid.");
  }

  const throughSchedule3 = await output.copyPages(signedFa, pageRange(0, schedule3Index));
  for (const page of throughSchedule3) output.addPage(page);

  const loPages = await output.copyPages(letterOfOffer, letterOfOffer.getPageIndices());
  for (const page of loPages) output.addPage(page);

  const remainingFa = await output.copyPages(
    signedFa,
    pageRange(schedule3Index + 1, eCertificateIndex)
  );
  for (const page of remainingFa) output.addPage(page);

  for (const certificatePdf of input.certificatePdfs) {
    const certificate = await PDFDocument.load(new Uint8Array(certificatePdf));
    const certificatePages = await output.copyPages(certificate, certificate.getPageIndices());
    for (const page of certificatePages) output.addPage(page);
  }

  return Buffer.from(await output.save());
}

/**
 * Copy signed FA pages around unique divider anchors, inserting a live LO and
 * current certificates. Does not mutate the signed FA bytes.
 */
export async function composeFacilityAgreementPackage(
  input: ComposeFacilityAgreementPackageInput
): Promise<ComposeFacilityAgreementPackageResult> {
  const items = await extractPdfTextItems(input.signedFaPdf);
  const anchors = findFacilityAgreementPackageAnchors(items);
  const bytes = await assembleFacilityAgreementPackagePages({
    ...input,
    ...anchors,
  });
  return {
    bytes,
    schedule3Page: anchors.schedule3Page,
    eCertificatePage: anchors.eCertificatePage,
    pageCount: (await PDFDocument.load(bytes)).getPageCount(),
  };
}
