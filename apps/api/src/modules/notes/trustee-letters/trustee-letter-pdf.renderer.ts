import PDFDocument from "pdfkit";
import type { TrusteeLetterData } from "./trustee-letter.types";
import { logger } from "../../../lib/logger";

const PAGE_MARGIN = 48;
const TABLE_COLUMNS = [
  { key: "no", label: "No.", width: 28 },
  { key: "nameOfPayee", label: "Name of Payee", width: 130 },
  { key: "accountNo", label: "Account No.", width: 90 },
  { key: "banker", label: "Banker", width: 80 },
  { key: "amount", label: "Amount (RM)", width: 72 },
  { key: "remarks", label: "Remarks", width: 97 },
] as const;
const TABLE_BORDER_COLOR = "#666";
const TABLE_HEADER_FILL_COLOR = "#fff";
const TABLE_BODY_FILL_COLOR = "#fff";
const SIGNATURE_MAX_WIDTH = 200;
const SIGNATURE_MAX_HEIGHT = 80;

function formatRm(amount: number): string {
  return amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function measureWrappedHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  fontSize: number
): number {
  doc.fontSize(fontSize);
  return doc.heightOfString(text || "—", { width });
}

function drawWrappedCell(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number
) {
  doc.fontSize(fontSize).fillColor("#111").text(text || "—", x, y, { width, align: "left" });
}

export async function renderTrusteeLetterPdf(data: TrusteeLetterData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  doc.fontSize(10).fillColor("#111").text(`Our Ref: ${data.ourRef}`, PAGE_MARGIN, y, { continued: false });
  doc.text(`Date: ${data.date}`, PAGE_MARGIN, y, { align: "right", width: contentWidth });
  y += 24;

  doc.fontSize(11).text(data.trusteeName, PAGE_MARGIN, y);
  y += 14;
  for (const line of data.trusteeAddressLines) {
    doc.text(line, PAGE_MARGIN, y);
    y += 14;
  }
  y += 4;
  doc.text(`Attention: ${data.attentionPerson}`, PAGE_MARGIN, y);
  y += 24;

  doc.text("Dear Sir/Madam,", PAGE_MARGIN, y);
  y += 24;

  doc.font("Helvetica-Bold").fontSize(12).text(data.platformDisplayName, PAGE_MARGIN, y);
  y += 16;
  doc.font("Helvetica-Bold").text(data.instructionTitle, PAGE_MARGIN, y);
  y += 18;
  doc.font("Helvetica").fontSize(10);
  doc.text(`Account No: ${data.debitAccountNumber || "—"}`, PAGE_MARGIN, y);
  y += 14;
  doc.text(`Account Name: ${data.debitAccountName || "—"}`, PAGE_MARGIN, y);
  y += 20;

  doc.text(data.openingParagraph, PAGE_MARGIN, y, { width: contentWidth });
  y += doc.heightOfString(data.openingParagraph, { width: contentWidth }) + 16;

  doc.text(`Value Date: ${data.valueDate}`, PAGE_MARGIN, y);
  y += 14;
  doc.text(`Purpose: ${data.purpose}`, PAGE_MARGIN, y);
  y += 20;

  const tableX = PAGE_MARGIN;
  const headerHeight = 22;
  doc.font("Helvetica-Bold").fontSize(9);
  let colX = tableX;
  for (const col of TABLE_COLUMNS) {
    doc
      .save()
      .rect(colX, y, col.width, headerHeight)
      .fillAndStroke(TABLE_HEADER_FILL_COLOR, TABLE_BORDER_COLOR)
      .restore();
    doc.text(col.label, colX + 4, y + 6, { width: col.width - 8, align: col.key === "amount" ? "right" : "left" });
    colX += col.width;
  }
  y += headerHeight;

  doc.font("Helvetica").fontSize(8);
  for (const row of data.paymentRows) {
    const cellValues = [
      String(row.no),
      row.nameOfPayee,
      row.accountNo,
      row.banker,
      formatRm(row.amount),
      row.remarks,
    ];
    const rowHeights = TABLE_COLUMNS.map((col, index) =>
      measureWrappedHeight(doc, cellValues[index] ?? "", col.width - 8, 8)
    );
    const rowHeight = Math.max(22, ...rowHeights) + 8;

    if (y + rowHeight > doc.page.height - PAGE_MARGIN - 120) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    colX = tableX;
    TABLE_COLUMNS.forEach((col, index) => {
      doc
        .save()
        .rect(colX, y, col.width, rowHeight)
        .fillAndStroke(TABLE_BODY_FILL_COLOR, TABLE_BORDER_COLOR)
        .restore();
      const value = cellValues[index] ?? "";
      if (col.key === "amount") {
        doc.fontSize(8).fillColor("#111").text(value, colX + 4, y + 4, {
          width: col.width - 8,
          align: "right",
        });
      } else {
        drawWrappedCell(doc, value, colX + 4, y + 4, col.width - 8, 8);
      }
      colX += col.width;
    });
    y += rowHeight;
  }

  y += 16;
  if (data.supportingParagraph) {
    doc.font("Helvetica").fontSize(10).fillColor("#111");
    doc.text(data.supportingParagraph, PAGE_MARGIN, y, { width: contentWidth });
    y += doc.heightOfString(data.supportingParagraph, { width: contentWidth }) + 16;
  }

  if (data.enclosingDocuments) {
    const enclosing =
      "We also enclose supporting documents for your reference. Your attention on this matter is very much appreciated.";
    doc.text(enclosing, PAGE_MARGIN, y, { width: contentWidth });
    y += doc.heightOfString(enclosing, { width: contentWidth }) + 16;
  }

  const queryLine = `Should you have any queries, please do not hesitate to contact ${data.contactPerson}.`;
  doc.text(queryLine, PAGE_MARGIN, y, { width: contentWidth });
  y += doc.heightOfString(queryLine, { width: contentWidth }) + 24;

  doc.text("Thank you.", PAGE_MARGIN, y);
  y += 20;
  doc.text("Yours faithfully,", PAGE_MARGIN, y);
  y += 16;
  doc.text(`For and on behalf of ${data.platformDisplayName}`, PAGE_MARGIN, y);
  y += 24;

  let drewSignatureImage = false;
  if (data.authorisedSignatureImage && data.authorisedSignatureImage.length > 0) {
    try {
      doc.image(data.authorisedSignatureImage, PAGE_MARGIN, y, {
        fit: [SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT],
      });
      y += SIGNATURE_MAX_HEIGHT + 8;
      drewSignatureImage = true;
    } catch (error) {
      logger.warn(
        { err: error, bytes: data.authorisedSignatureImage.length },
        "Failed to render authorised signature image in trustee letter PDF"
      );
    }
  }

  if (!drewSignatureImage) {
    y += 24;
    doc.text("_____________________________________", PAGE_MARGIN, y);
    y += 16;
  }

  doc.text(data.authorisedSignatoryLabel, PAGE_MARGIN, y);

  doc.end();
  return done;
}
