import PizZip from "pizzip";
import { sampleInvestmentNoteCertificateSnapshot } from "../investment-note-certificate/certificate-fixture";
import { renderInvestmentNoteCertificateDocx } from "../investment-note-certificate/render-certificate-docx";
import {
  applyCompanyStampToDocx,
  stampExtentEmu,
  stampExtentEmuFromPixels,
} from "./docx-stamp-image";

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
    const extent = stampExtentEmu(TWO_BY_ONE_PNG);
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
});
