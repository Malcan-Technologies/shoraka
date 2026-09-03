/**
 * Re-export the shared LibreOffice converter. Letter of Offer callers keep this
 * import path; default upload filename remains letter-of-offer.docx.
 */
export {
  convertDocxToPdf,
  DocxToPdfError,
  resolveGotenbergUrl,
  type ConvertDocxToPdfOptions,
} from "../../../lib/gotenberg/convert-docx-to-pdf";
