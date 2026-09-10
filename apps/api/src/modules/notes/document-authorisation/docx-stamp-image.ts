import PizZip from "pizzip";
import { fitStampImageForDocx, type StampExtentEmu } from "./stamp-image-contain";

export const COMPANY_STAMP_IMAGE_PLACEHOLDER = "§COMPANY_STAMP_IMAGE§";
export const SIGNATURE_IMAGE_PLACEHOLDER = "§SIGNATURE_IMAGE§";
export const COMPANY_STAMP_UNDERSCORE_FALLBACK = "________________________";
export {
  stampExtentEmu,
  stampExtentEmuFromPixels,
  type StampExtentEmu,
} from "./stamp-image-contain";

const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const DRAWINGML_MAIN = "http://schemas.openxmlformats.org/drawingml/2006/main";
const DRAWINGML_PICTURE = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A14_NS = "http://schemas.microsoft.com/office/drawing/2010/main";

/** Same id Word uses on wp:docPr / pic:cNvPr. LibreOffice rejects pic:cNvPr id="0". */
const STAMP_DRAWING_ID = 91001;
const SIGNATURE_DRAWING_ID = 91002;

type StampImageInput = {
  bytes: Buffer;
  contentType?: string | null;
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

function inlineStampDrawingXml(
  relationshipId: string,
  extent: StampExtentEmu,
  drawing: { id: number; docPrName: string; picName: string }
): string {
  const { cx, cy } = extent;
  return (
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${drawing.id}" name="${drawing.docPrName}"/>` +
    `<wp:cNvGraphicFramePr>` +
    `<a:graphicFrameLocks xmlns:a="${DRAWINGML_MAIN}" noChangeAspect="1"/>` +
    `</wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${DRAWINGML_MAIN}">` +
    `<a:graphicData uri="${DRAWINGML_PICTURE}">` +
    `<pic:pic xmlns:pic="${DRAWINGML_PICTURE}">` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="${drawing.id}" name="${drawing.picName}"/>` +
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
function replacePlaceholderRun(documentXml: string, placeholder: string, innerXml: string): string {
  const tokenIndex = documentXml.indexOf(placeholder);
  if (tokenIndex < 0) return documentXml;
  const runOpen = lastWordRunOpenIndex(documentXml, tokenIndex);
  const runClose = documentXml.indexOf("</w:r>", tokenIndex);
  if (runOpen < 0 || runClose < 0 || runClose < runOpen) {
    return documentXml.split(placeholder).join("");
  }
  return (
    documentXml.slice(0, runOpen) +
    `<w:r>${innerXml}</w:r>` +
    documentXml.slice(runClose + "</w:r>".length)
  );
}

/**
 * After docxtemplater render, insert a frozen image (or restore the original
 * underscore line when no image was configured).
 */
function applyPlaceholderImageToDocx(
  docx: Buffer,
  input: {
    placeholder: string;
    image: StampImageInput | null | undefined;
    mediaBaseName: string;
    drawing: { id: number; docPrName: string; picName: string };
  }
): Buffer {
  const zip = new PizZip(docx);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return docx;
  let documentXml = documentFile.asText();
  if (!documentXml.includes(input.placeholder)) {
    return docx;
  }

  if (!input.image || input.image.bytes.length === 0) {
    documentXml = documentXml.split(input.placeholder).join(COMPANY_STAMP_UNDERSCORE_FALLBACK);
    zip.file("word/document.xml", documentXml);
    return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  }

  const fitted = fitStampImageForDocx(input.image.bytes, input.image.contentType);
  const { ext, mime } = stampExtension(fitted.contentType);
  const mediaFile = `${input.mediaBaseName}.${ext}`;
  zip.file(`word/media/${mediaFile}`, fitted.bytes);

  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  let relsXml = relsFile?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const relId = nextRelationshipId(relsXml);
  relsXml = relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${relId}" Type="${IMAGE_REL_TYPE}" Target="media/${mediaFile}"/></Relationships>`
  );
  zip.file(relsPath, relsXml);

  const contentTypesFile = zip.file("[Content_Types].xml");
  if (contentTypesFile) {
    zip.file(
      "[Content_Types].xml",
      ensureContentTypeDefault(contentTypesFile.asText(), ext, mime)
    );
  }

  documentXml = replacePlaceholderRun(
    documentXml,
    input.placeholder,
    inlineStampDrawingXml(relId, fitted.extent, input.drawing)
  );
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

export function applyCompanyStampToDocx(
  docx: Buffer,
  stamp: StampImageInput | null | undefined
): Buffer {
  return applyPlaceholderImageToDocx(docx, {
    placeholder: COMPANY_STAMP_IMAGE_PLACEHOLDER,
    image: stamp,
    mediaBaseName: "company-stamp",
    drawing: { id: STAMP_DRAWING_ID, docPrName: "CompanyStamp", picName: "company-stamp" },
  });
}

export function applySignatureImageToDocx(
  docx: Buffer,
  signature: StampImageInput | null | undefined
): Buffer {
  return applyPlaceholderImageToDocx(docx, {
    placeholder: SIGNATURE_IMAGE_PLACEHOLDER,
    image: signature,
    mediaBaseName: "signing-signature",
    drawing: { id: SIGNATURE_DRAWING_ID, docPrName: "Signature", picName: "signing-signature" },
  });
}

export function applyDocumentAuthorisationImagesToDocx(
  docx: Buffer,
  images: {
    signature?: StampImageInput | null;
    stamp?: StampImageInput | null;
  }
): Buffer {
  return applyCompanyStampToDocx(
    applySignatureImageToDocx(docx, images.signature),
    images.stamp
  );
}
