import PDFDocument from "pdfkit";

export type AssignmentNoticeParticulars = {
  noticeReference: string;
  generatedAt: Date;
  issuerName: string;
  issuerRegistrationNumber: string | null;
  paymasterName: string;
  paymasterRegistrationNumber: string;
  contractReference: string | null;
  invoiceReference: string | null;
  noteReference: string | null;
};

export async function renderAssignmentNoticeParticularsPdf(
  data: AssignmentNoticeParticulars
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 56, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const width = doc.page.width - 112;
  let y = 56;

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111").text("CashSouk", 56, y);
  y += 28;
  doc.font("Helvetica-Bold").fontSize(16).text("Notice of Assignment", 56, y);
  y += 36;

  doc.fillColor("#111").font("Helvetica").fontSize(10);
  const rows: Array<[string, string]> = [
    ["Reference", data.noticeReference],
    ["Generated", data.generatedAt.toISOString().slice(0, 10)],
    ["Issuer", data.issuerName],
    ["Issuer registration", data.issuerRegistrationNumber || "—"],
    ["Paymaster", data.paymasterName],
    ["Paymaster SSM / registration", data.paymasterRegistrationNumber],
    ["Facility / contract", data.contractReference || "—"],
    ["Invoice", data.invoiceReference || "—"],
    ["Note", data.noteReference || "—"],
  ];
  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").text(label, 56, y, { width: 180, continued: false });
    doc.font("Helvetica").text(value, 240, y, { width: width - 184 });
    y += 18;
  }

  doc.end();
  return done;
}
