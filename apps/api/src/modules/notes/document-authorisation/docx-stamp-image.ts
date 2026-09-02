import PizZip from "pizzip";

export const COMPANY_STAMP_IMAGE_PLACEHOLDER = "§COMPANY_STAMP_IMAGE§";
export const COMPANY_STAMP_UNDERSCORE_FALLBACK = "________________________";

const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const DRAWINGML_MAIN = "http://schemas.openxmlformats.org/drawingml/2006/main";
const DRAWINGML_PICTURE = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A14_NS = "http://schemas.microsoft.com/office/drawing/2010/main";

/** Same id Word uses on wp:docPr / pic:cNvPr. LibreOffice rejects pic:cNvPr id="0". */
const STAMP_DRAWING_ID = 91001;

/**
 * Fit the stamp into the authorisation table cell (~3080 twips / 2.14in wide).
 * A square EMU box with noChangeAspect=1 on a wide screenshot makes LibreOffice
 * fail or hang during Gotenberg conversion.
 */
const MAX_STAMP_WIDTH_EMU = 1_555_000;
const MAX_STAMP_HEIGHT_EMU = 792_000;

type StampImageInput = {
  bytes: Buffer;
  contentType?: string | null;
};

export type StampExtentEmu = {
  cx: number;
  cy: number;
};

function stampExtension(contentType: string | null | undefined): {
  ext: string;
  mime: string;
} {
  const normalized = (contentType ?? "").trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return { ext: "jpeg", mime: "image/jpeg" };
  }
  if (normalized === "image/webp") {
    return { ext: "webp", mime: "image/webp" };
  }
  return { ext: "png", mime: "image/png" };
}

function nextRelationshipId(relsXml: string): string {
  let max = 0;
  const re = /Id="rId(\d+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(relsXml))) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `rId${max + 1}`;
}

function ensureContentTypeDefault(contentTypesXml: string, ext: string, mime: string): string {
  const escaped = ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`Extension="${escaped}"`, "i").test(contentTypesXml)) {
    return contentTypesXml;
  }
  return contentTypesXml.replace(
    /<Types\b[^>]*>/,
    (open) => `${open}<Default Extension="${ext}" ContentType="${mime}"/>`
  );
}

function readPngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes.subarray(0, 8).compare(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) !== 0) {
    return null;
  }
  if (bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

function readJpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    const size = bytes.readUInt16BE(offset + 2);
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    offset += 2 + size;
  }
  return null;
}

export function stampExtentEmuFromPixels(width: number, height: number): StampExtentEmu {
  const w = width > 0 ? width : 1;
  const h = height > 0 ? height : 1;
  const heightIfFullWidth = Math.round((MAX_STAMP_WIDTH_EMU * h) / w);
  if (heightIfFullWidth <= MAX_STAMP_HEIGHT_EMU) {
    return { cx: MAX_STAMP_WIDTH_EMU, cy: Math.max(1, heightIfFullWidth) };
  }
  return {
    cx: Math.max(1, Math.round((MAX_STAMP_HEIGHT_EMU * w) / h)),
    cy: MAX_STAMP_HEIGHT_EMU,
  };
}

export function stampExtentEmu(bytes: Buffer): StampExtentEmu {
  const size = readPngSize(bytes) ?? readJpegSize(bytes);
  if (!size) return { cx: MAX_STAMP_HEIGHT_EMU, cy: MAX_STAMP_HEIGHT_EMU };
  return stampExtentEmuFromPixels(size.width, size.height);
}

function inlineStampDrawingXml(relationshipId: string, extent: StampExtentEmu): string {
  const { cx, cy } = extent;
  return (
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${STAMP_DRAWING_ID}" name="CompanyStamp"/>` +
    `<wp:cNvGraphicFramePr>` +
    `<a:graphicFrameLocks xmlns:a="${DRAWINGML_MAIN}" noChangeAspect="1"/>` +
    `</wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${DRAWINGML_MAIN}">` +
    `<a:graphicData uri="${DRAWINGML_PICTURE}">` +
    `<pic:pic xmlns:pic="${DRAWINGML_PICTURE}">` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="${STAMP_DRAWING_ID}" name="company-stamp"/>` +
    `<pic:cNvPicPr/>` +
    `</pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip r:embed="${relationshipId}" xmlns:r="${OFFICE_REL_NS}">` +
    `<a:extLst>` +
    `<a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">` +
    `<a14:useLocalDpi xmlns:a14="${A14_NS}" val="0"/>` +
    `</a:ext>` +
    `</a:extLst>` +
    `</a:blip>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr>` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  );
}

function lastWordRunOpenIndex(xml: string, before: number): number {
  let from = before;
  while (from > 0) {
    const idx = xml.lastIndexOf("<w:r", from);
    if (idx < 0) return -1;
    const after = xml[idx + 4];
    if (after === ">" || after === " " || after === "\t" || after === "\n" || after === "/") {
      return idx;
    }
    from = idx - 1;
  }
  return -1;
}

/**
 * Replace only the w:r that contains the stamp placeholder.
 * A `/<w:r>[\s\S]*?placeholder/` regex starts at the first run in the document
 * and deletes the identifier tables, which makes LibreOffice reject the DOCX.
 */
function replacePlaceholderRun(documentXml: string, innerXml: string): string {
  const tokenIndex = documentXml.indexOf(COMPANY_STAMP_IMAGE_PLACEHOLDER);
  if (tokenIndex < 0) return documentXml;
  const runOpen = lastWordRunOpenIndex(documentXml, tokenIndex);
  const runClose = documentXml.indexOf("</w:r>", tokenIndex);
  if (runOpen < 0 || runClose < 0 || runClose < runOpen) {
    return documentXml.split(COMPANY_STAMP_IMAGE_PLACEHOLDER).join("");
  }
  return (
    documentXml.slice(0, runOpen) +
    `<w:r>${innerXml}</w:r>` +
    documentXml.slice(runClose + "</w:r>".length)
  );
}

/**
 * After docxtemplater render, insert the frozen company stamp image (or restore
 * the original underscore line when no image was configured).
 */
export function applyCompanyStampToDocx(
  docx: Buffer,
  stamp: StampImageInput | null | undefined
): Buffer {
  const zip = new PizZip(docx);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return docx;
  let documentXml = documentFile.asText();
  if (!documentXml.includes(COMPANY_STAMP_IMAGE_PLACEHOLDER)) {
    return docx;
  }

  if (!stamp || stamp.bytes.length === 0) {
    documentXml = documentXml.split(COMPANY_STAMP_IMAGE_PLACEHOLDER).join(
      COMPANY_STAMP_UNDERSCORE_FALLBACK
    );
    zip.file("word/document.xml", documentXml);
    return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  }

  const { ext, mime } = stampExtension(stamp.contentType);
  const mediaPath = `word/media/company-stamp.${ext}`;
  zip.file(mediaPath, stamp.bytes);

  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  let relsXml = relsFile?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const relId = nextRelationshipId(relsXml);
  relsXml = relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${relId}" Type="${IMAGE_REL_TYPE}" Target="media/company-stamp.${ext}"/></Relationships>`
  );
  zip.file(relsPath, relsXml);

  const contentTypesFile = zip.file("[Content_Types].xml");
  if (contentTypesFile) {
    zip.file(
      "[Content_Types].xml",
      ensureContentTypeDefault(contentTypesFile.asText(), ext, mime)
    );
  }

  documentXml = replacePlaceholderRun(documentXml, inlineStampDrawingXml(relId, stampExtentEmu(stamp.bytes)));
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
