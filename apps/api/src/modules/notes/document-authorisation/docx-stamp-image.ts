import PizZip from "pizzip";

export const COMPANY_STAMP_IMAGE_PLACEHOLDER = "§COMPANY_STAMP_IMAGE§";
export const COMPANY_STAMP_UNDERSCORE_FALLBACK = "________________________";

const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

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

function inlineStampDrawingXml(relationshipId: string): string {
  const cx = 792000;
  const cy = 792000;
  return (
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="91001" name="CompanyStamp"/>` +
    `<wp:cNvGraphicFramePr>` +
    `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
    `</wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="0" name="company-stamp"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  );
}

function replacePlaceholderRun(documentXml: string, innerXml: string): string {
  const pattern = new RegExp(
    `<w:r\\b[^>]*>[\\s\\S]*?<w:t\\b[^>]*>${COMPANY_STAMP_IMAGE_PLACEHOLDER}</w:t>[\\s\\S]*?</w:r>`
  );
  if (!pattern.test(documentXml)) {
    return documentXml.split(COMPANY_STAMP_IMAGE_PLACEHOLDER).join("");
  }
  return documentXml.replace(pattern, `<w:r>${innerXml}</w:r>`);
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

  documentXml = replacePlaceholderRun(documentXml, inlineStampDrawingXml(relId));
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
