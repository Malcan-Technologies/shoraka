import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  assembleFacilityAgreementPackagePages,
  composeFacilityAgreementPackage,
  FaPackageAnchorError,
  findFacilityAgreementPackageAnchors,
  normalizePdfDividerText,
} from "./facility-agreement-package";

function item(pageindex: number, text: string) {
  return { pageindex, text };
}

async function pdfWithPageSizes(sizes: Array<[number, number]>): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (const [width, height] of sizes) {
    doc.addPage([width, height]);
  }
  return Buffer.from(await doc.save());
}

async function pageSizes(buffer: Buffer): Promise<Array<[number, number]>> {
  const doc = await PDFDocument.load(buffer);
  return doc.getPages().map((page) => {
    const { width, height } = page.getSize();
    return [width, height];
  });
}

describe("facility agreement package anchors", () => {
  it("normalizes divider punctuation and whitespace", () => {
    expect(normalizePdfDividerText("SCHEDULE 3(LETTER OF OFFER)")).toBe(
      "SCHEDULE 3 LETTER OF OFFER"
    );
    expect(normalizePdfDividerText("Attachment (e-Certificate)")).toBe("ATTACHMENT E CERTIFICATE");
  });

  it("requires unique in-order divider pages", () => {
    const items = [
      item(1, "Cover"),
      item(2, "SCHEDULE 3 (LETTER OF OFFER)"),
      item(3, "Schedule 4"),
      item(4, "Attachment (e-Certificate)"),
    ];
    expect(findFacilityAgreementPackageAnchors(items)).toEqual({
      schedule3Page: 2,
      eCertificatePage: 4,
    });
  });

  it("fails closed when an anchor is missing, duplicated, or out of order", () => {
    expect(() =>
      findFacilityAgreementPackageAnchors([item(1, "SCHEDULE 3 LETTER OF OFFER")])
    ).toThrow(FaPackageAnchorError);
    expect(() =>
      findFacilityAgreementPackageAnchors([
        item(1, "SCHEDULE 3 (LETTER OF OFFER)"),
        item(2, "SCHEDULE 3 (LETTER OF OFFER)"),
        item(3, "Attachment (e-Certificate)"),
      ])
    ).toThrow(/more than one/);
    expect(() =>
      findFacilityAgreementPackageAnchors([
        item(1, "Attachment (e-Certificate)"),
        item(2, "SCHEDULE 3 (LETTER OF OFFER)"),
      ])
    ).toThrow(/out of order/);
  });
});

describe("facility agreement package assembly", () => {
  it("inserts LO after Schedule 3 and certificates after the e-Certificate divider", async () => {
    const signedFa = await pdfWithPageSizes([
      [500, 700],
      [510, 710],
      [520, 720],
      [530, 730],
      [540, 740],
    ]);
    const originalFa = Buffer.from(signedFa);
    const letter = await pdfWithPageSizes([
      [400, 600],
      [410, 610],
    ]);
    const certA = await pdfWithPageSizes([[300, 400]]);
    const certB = await pdfWithPageSizes([[310, 410]]);

    const none = await assembleFacilityAgreementPackagePages({
      signedFaPdf: signedFa,
      letterOfOfferPdf: letter,
      certificatePdfs: [],
      schedule3Page: 2,
      eCertificatePage: 4,
      title: "compiled",
    });
    expect(await pageSizes(none)).toEqual([
      [500, 700],
      [510, 710],
      [400, 600],
      [410, 610],
      [520, 720],
      [530, 730],
    ]);

    const one = await assembleFacilityAgreementPackagePages({
      signedFaPdf: signedFa,
      letterOfOfferPdf: letter,
      certificatePdfs: [certA],
      schedule3Page: 2,
      eCertificatePage: 4,
      title: "compiled",
    });
    expect(await pageSizes(one)).toEqual([
      [500, 700],
      [510, 710],
      [400, 600],
      [410, 610],
      [520, 720],
      [530, 730],
      [300, 400],
    ]);

    const many = await assembleFacilityAgreementPackagePages({
      signedFaPdf: signedFa,
      letterOfOfferPdf: letter,
      certificatePdfs: [certA, certB],
      schedule3Page: 2,
      eCertificatePage: 4,
      title: "compiled",
    });
    expect(await pageSizes(many)).toEqual([
      [500, 700],
      [510, 710],
      [400, 600],
      [410, 610],
      [520, 720],
      [530, 730],
      [300, 400],
      [310, 410],
    ]);

    expect(Buffer.compare(signedFa, originalFa)).toBe(0);
  });

  it("composes from extracted divider text without mutating the signed FA bytes", async () => {
    const signedFa = await pdfWithDividerText();
    const original = Buffer.from(signedFa);
    const letter = await pdfWithPageSizes([[400, 600]]);
    const result = await composeFacilityAgreementPackage({
      signedFaPdf: signedFa,
      letterOfOfferPdf: letter,
      certificatePdfs: [],
      title: "compiled",
    });
    expect(result.schedule3Page).toBe(2);
    expect(result.eCertificatePage).toBe(4);
    expect(result.pageCount).toBe(5);
    expect(Buffer.compare(signedFa, original)).toBe(0);
  });
});

async function pdfWithDividerText(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const texts = [
    "Cover",
    "SCHEDULE 3 (LETTER OF OFFER)",
    "Schedule 4",
    "Attachment (e-Certificate)",
  ];
  for (const text of texts) {
    const page = doc.addPage([595, 842]);
    page.drawText(text, { x: 50, y: 700, size: 14, font });
  }
  return Buffer.from(await doc.save());
}
