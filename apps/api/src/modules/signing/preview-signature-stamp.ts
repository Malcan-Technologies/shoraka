import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { EnvelopePlan } from "@cashsouk/types";
import {
  buildStackedSigningCloudSignsets,
  type SigningCloudSignField,
} from "../applications/joint-several-guarantee/jsg-signing-signsets";

export type WetInkPreviewField = {
  top: number;
  left: number;
  height: number;
  width: number;
  pageindex: number;
  label: string;
  /** False for JSG: the form already names the signer; extra caption covers the labels. */
  showAnnotations?: boolean;
};

export function signerNamesForPlannedDocument(
  plan: EnvelopePlan,
  documentKey: string
): string[] {
  const byRef = new Map(plan.recipients.map((recipient) => [recipient.ref, recipient]));
  return plan.assignments
    .filter((assignment) => assignment.document_ref === documentKey)
    .map((assignment) => byRef.get(assignment.recipient_ref))
    .filter((recipient): recipient is NonNullable<typeof recipient> => recipient != null)
    .sort((a, b) => {
      const order = a.routing_order - b.routing_order;
      if (order !== 0) return order;
      return a.name.localeCompare(b.name);
    })
    .map((recipient) => recipient.name);
}

/** Map signer names onto stacked SigningCloud rectangles on the given 1-based page. */
export function buildWetInkPreviewFields(
  signerNames: string[],
  pageindex: number
): WetInkPreviewField[] {
  const signsets = buildStackedSigningCloudSignsets(signerNames.length, pageindex);
  return signsets.map((fields, index) => {
    const field = fields[0];
    return {
      top: field?.top ?? 549,
      left: field?.left ?? 140,
      height: field?.height ?? 30,
      width: field?.width ?? 100,
      pageindex: field?.pageindex ?? pageindex,
      label: signerNames[index]?.trim() || `Signatory ${index + 1}`,
    };
  });
}

/** Map signer names onto already-computed SigningCloud rectangles (JSG execution lines). */
export function previewFieldsFromSignsets(
  signerNames: string[],
  signsets: SigningCloudSignField[][]
): WetInkPreviewField[] {
  return signsets.map((fields, index) => {
    const field = fields[0];
    return {
      top: field?.top ?? 549,
      left: field?.left ?? 140,
      height: field?.height ?? 30,
      width: field?.width ?? 100,
      pageindex: field?.pageindex ?? 1,
      label: signerNames[index]?.trim() || `Signatory ${index + 1}`,
      showAnnotations: false,
    };
  });
}

function sanitizePreviewFilenameToken(name: string): string {
  const token = name.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
  return token || "document";
}

export function signingDocumentPreviewFilename(documentName: string): string {
  return `Preview-${sanitizePreviewFilenameToken(documentName)}.pdf`;
}

/**
 * Draw non-interactive signature rectangles on an existing PDF.
 * SigningCloud `top` is measured from the top of the page; pdf-lib uses bottom-left origin.
 */
export async function stampWetInkSignatureFields(
  pdfBuffer: Buffer,
  fields: WetInkPreviewField[]
): Promise<Buffer> {
  if (fields.length === 0) return pdfBuffer;
  const pdf = await PDFDocument.load(pdfBuffer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pageCount = pdf.getPageCount();
  const ink = rgb(0.15, 0.15, 0.15);

  for (const field of fields) {
    const pageNumber = Math.min(Math.max(field.pageindex, 1), Math.max(pageCount, 1));
    const page = pdf.getPage(pageNumber - 1);
    const pageHeight = page.getHeight();
    const rectY = pageHeight - field.top - field.height;
    page.drawRectangle({
      x: field.left,
      y: rectY,
      width: field.width,
      height: field.height,
      borderColor: ink,
      borderWidth: 1,
    });
    if (field.showAnnotations === false) continue;
    page.drawText("Signature", {
      x: field.left + 6,
      y: rectY + field.height / 2 - 4,
      size: 8,
      font,
      color: ink,
    });
    const name = field.label.length > 48 ? `${field.label.slice(0, 45)}…` : field.label;
    page.drawText(name, {
      x: field.left,
      y: Math.max(24, rectY - 12),
      size: 8,
      font,
      color: ink,
    });
  }

  return Buffer.from(await pdf.save());
}
