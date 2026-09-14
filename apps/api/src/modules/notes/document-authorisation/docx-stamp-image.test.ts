import PizZip from "pizzip";
import { sampleInvestmentNoteCertificateSnapshot } from "../investment-note-certificate/certificate-fixture";
import { renderInvestmentNoteCertificateDocx } from "../investment-note-certificate/render-certificate-docx";
import {
  applyCompanyStampToDocx,
  applySspStampToDocx,
  COMPACT_MAX_STAMP_HEIGHT_EMU,
  COMPACT_MAX_STAMP_WIDTH_EMU,
  SSP_COMPANY_STAMP_IMAGE_PLACEHOLDER,
  stampExtentEmuFromPixels,
} from "./docx-stamp-image";
import { readPngSize, type StampMaxBoundsEmu } from "./stamp-image-contain";
import { PNG } from "pngjs";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFhAH+plp0OQAAAABJRU5ErkJggg==",
  "base64"
);

const TWO_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8DwH4QBEfcD/ePF9e8AAAAASUVORK5CYII=",
  "base64"
);

function drawingXml(docx: Buffer): string {
  const zip = new PizZip(docx);
  return zip.file("word/document.xml")?.asText() ?? "";
}

function wordPlainText(xml: string): string {
  let text = "";
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    text += (match[1] ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  }
  return text;
}

describe("stampExtentEmuFromPixels", () => {
  it("preserves a wide screenshot aspect ratio inside the authorisation cell", () => {
    const extent = stampExtentEmuFromPixels(2196, 824);
    expect(extent.cx).toBe(1_555_000);
    expect(extent.cy).toBe(Math.round((1_555_000 * 824) / 2196));
    expect(extent.cy).toBeLessThan(extent.cx);
    expect(extent.cx / extent.cy).toBeCloseTo(2196 / 824, 5);
  });

  it("caps height for nearly-square images", () => {
    const extent = stampExtentEmuFromPixels(502, 475);
    expect(extent.cy).toBe(792_000);
    expect(extent.cx).toBe(Math.round((792_000 * 502) / 475));
  });
});

describe("applyCompanyStampToDocx", () => {
  it("injects Word-compatible drawing XML with matching non-zero picture ids", () => {
    const rendered = renderInvestmentNoteCertificateDocx(
      sampleInvestmentNoteCertificateSnapshot(),
      { audience: "ADMIN" },
      { bytes: TWO_BY_ONE_PNG, contentType: "image/png" }
    );
    const xml = drawingXml(rendered);
    const zip = new PizZip(rendered);
    expect(zip.file("word/media/company-stamp.png")).toBeTruthy();
    expect(xml).toContain('<pic:cNvPr id="91001" name="company-stamp"/>');
    expect(xml).toContain('<wp:docPr id="91001" name="CompanyStamp"/>');
    expect(xml).not.toContain('<pic:cNvPr id="0"');
    const bounds: StampMaxBoundsEmu = {
      maxWidthEmu: COMPACT_MAX_STAMP_WIDTH_EMU,
      maxHeightEmu: COMPACT_MAX_STAMP_HEIGHT_EMU,
    };
    const extent = stampExtentEmuFromPixels(2, 1, bounds);
    expect(xml).toContain(`<wp:extent cx="${extent.cx}" cy="${extent.cy}"/>`);
    expect(xml).toContain(`<a:ext cx="${extent.cx}" cy="${extent.cy}"/>`);
    expect(xml).toContain("r:embed=");
    const plain = wordPlainText(xml);
    expect(plain).toContain("Certificate no.");
    expect(plain).toContain("IINC-NOTE-20260902-AAA");
    expect(plain).toContain("Helios Manufacturing Sdn Bhd");
    expect(plain).toContain("INVESTOR SCHEDULE");
    expect(plain).toContain("Alice Tan");
  });

  it("still embeds a 1×1 PNG used by existing certificate/receipt tests", () => {
    const rendered = renderInvestmentNoteCertificateDocx(
      sampleInvestmentNoteCertificateSnapshot(),
      { audience: "ADMIN" },
      { bytes: ONE_BY_ONE_PNG, contentType: "image/png" }
    );
    const xml = drawingXml(rendered);
    expect(xml).toContain("<w:drawing>");
    expect(xml).toContain('<pic:cNvPr id="91001"');
  });

  it("leaves underscores when no stamp bytes are provided", () => {
    const rendered = applyCompanyStampToDocx(
      renderInvestmentNoteCertificateDocx(sampleInvestmentNoteCertificateSnapshot(), {
        audience: "ADMIN",
      }),
      null
    );
    const xml = drawingXml(rendered);
    expect(xml).toContain("________________________");
    expect(xml).not.toContain("<w:drawing>");
  });

  it("preserves a large stamp bitmap and still caps rendered footprint via wp:extent", () => {
    const png = new PNG({ width: 800, height: 800 });
    png.data.fill(200);
    for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
    const rendered = renderInvestmentNoteCertificateDocx(
      sampleInvestmentNoteCertificateSnapshot(),
      { audience: "ADMIN" },
      { bytes: PNG.sync.write(png), contentType: "image/png" }
    );
    const zip = new PizZip(rendered);
    const embedded = zip.file("word/media/company-stamp.png")?.asNodeBuffer();
    expect(embedded).toBeTruthy();
    const size = readPngSize(embedded!);
    expect(size).toEqual({ width: 800, height: 800 });
    const xml = drawingXml(rendered);
    expect(xml).toContain(`<wp:extent cx="${COMPACT_MAX_STAMP_HEIGHT_EMU}" cy="${COMPACT_MAX_STAMP_HEIGHT_EMU}"/>`);
  });
});

describe("applySspStampToDocx", () => {
  function sspPlaceholderDocx(): Buffer {
    const zip = new PizZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
    );
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${SSP_COMPANY_STAMP_IMAGE_PLACEHOLDER}</w:t></w:r></w:p></w:body></w:document>`
    );
    return zip.generate({ type: "nodebuffer" }) as Buffer;
  }

  it("embeds ssp-company-stamp media and removes the placeholder", () => {
    const rendered = applySspStampToDocx(sspPlaceholderDocx(), {
      bytes: TWO_BY_ONE_PNG,
      contentType: "image/png",
    });
    const zip = new PizZip(rendered);
    const xml = drawingXml(rendered);
    expect(zip.file("word/media/ssp-company-stamp.png")).toBeTruthy();
    expect(xml).toContain('<pic:cNvPr id="91003" name="ssp-company-stamp"/>');
    expect(xml).toContain('<wp:docPr id="91003" name="SspCompanyStamp"/>');
    expect(xml).not.toContain(SSP_COMPANY_STAMP_IMAGE_PLACEHOLDER);
  });

  it("leaves no underscores when the SSP stamp is empty", () => {
    const rendered = applySspStampToDocx(sspPlaceholderDocx(), null);
    const xml = drawingXml(rendered);
    expect(xml).not.toContain(SSP_COMPANY_STAMP_IMAGE_PLACEHOLDER);
    expect(xml).not.toContain("________________________");
    expect(xml).not.toContain("<w:drawing>");
  });
});

describe("applySignatureImageToDocx", () => {
  it("injects a signature image independently of the company stamp", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFhAH+plp0OQAAAABJRU5ErkJggg==",
      "base64"
    );
    const rendered = renderInvestmentNoteCertificateDocx(
      sampleInvestmentNoteCertificateSnapshot(),
      { audience: "ADMIN" },
      { bytes: TWO_BY_ONE_PNG, contentType: "image/png" },
      { bytes: png, contentType: "image/png" }
    );
    const xml = drawingXml(rendered);
    const zip = new PizZip(rendered);
    expect(zip.file("word/media/company-stamp.png")).toBeTruthy();
    expect(zip.file("word/media/signing-signature.png")).toBeTruthy();
    expect(xml).toContain('<pic:cNvPr id="91001" name="company-stamp"/>');
    expect(xml).toContain('<pic:cNvPr id="91002" name="signing-signature"/>');
    expect(xml).not.toContain("§SIGNATURE_IMAGE§");
  });
});
