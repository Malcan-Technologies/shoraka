import PizZip from "pizzip";

/**
 * LibreOffice/SigningCloud PDF viewers draw each Arial "_" with side bearings.
 * Justified paragraphs then stretch those gaps, so a solid Word line looks dashed.
 * Pull the glyphs together and left-align stroke-only rows. Keep the characters
 * black and extractable so SigningCloud placement still sees the stroke.
 */
const STROKE_CHAR_SPACING = "-40";
const ONLY_UNDERSCORES = /^_{8,}$/;

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function runText(runXml: string): string {
  return [...runXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1] ?? ""))
    .join("");
}

function paragraphPlainText(pXml: string): string {
  let text = "";
  const tokenRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^/]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(pXml))) {
    if (/^<w:tab/.test(match[0])) text += "\t";
    else text += decodeXml(match[1] ?? "");
  }
  return text;
}

function stripStrokeOverrides(rPr: string): string {
  return rPr
    .replace(/<w:spacing\b[^/]*\/>/g, "")
    .replace(/<w:color\b[^/]*\/>/g, "")
    .replace(/<w:u\b[^/]*\/>/g, "")
    .replace(/<w:u\b[\s\S]*?<\/w:u>/g, "");
}

function withConnectedUnderscoreStyle(runXml: string): string {
  const spacing = `<w:spacing w:val="${STROKE_CHAR_SPACING}"/>`;
  const existingRpr = runXml.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0];
  if (!existingRpr) {
    return runXml.replace(/(<w:r\b[^>]*>)/, `$1<w:rPr>${spacing}</w:rPr>`);
  }
  const cleanRpr = stripStrokeOverrides(existingRpr);
  return runXml.replace(existingRpr, cleanRpr.replace("</w:rPr>", `${spacing}</w:rPr>`));
}

function solidifySignatureRuns(xml: string): string {
  return xml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (runXml) => {
    const trimmed = runText(runXml).trim();
    // Leave "Date: ________________" in one run. Splitting the stroke makes the
    // PDF extractor treat those underscores as a signature line and then miss
    // the Date label for SigningCloud.
    if (!ONLY_UNDERSCORES.test(trimmed)) return runXml;
    return withConnectedUnderscoreStyle(runXml);
  });
}

function leftAlignUnderscoreParagraphs(xml: string): string {
  return xml.replace(/<w:p\b[^>]*\/>|<w:p\b[\s\S]*?<\/w:p>/g, (pXml) => {
    const text = paragraphPlainText(pXml);
    if (text.includes("\t")) return pXml;
    const compact = text.replace(/\t+/g, "").replace(/ +/g, "").trim();
    if (!ONLY_UNDERSCORES.test(compact)) return pXml;
    if (/<w:jc\b/.test(pXml)) {
      return pXml.replace(/<w:jc\b[^/]*\/>/, '<w:jc w:val="left"/>');
    }
    if (pXml.includes("<w:pPr>")) {
      return pXml.replace("<w:pPr>", '<w:pPr><w:jc w:val="left"/>');
    }
    return pXml.replace(/^<w:p([^>]*)>/, `<w:p$1><w:pPr><w:jc w:val="left"/></w:pPr>`);
  });
}

export function solidifySignatureLinesInXml(xml: string): string {
  return leftAlignUnderscoreParagraphs(solidifySignatureRuns(xml));
}

export function solidifySignatureLinesInDocx(docx: Buffer): Buffer {
  const zip = new PizZip(docx);
  const documentXml = zip.file("word/document.xml")?.asText();
  if (!documentXml) {
    throw new Error("Generated document is missing word/document.xml");
  }

  zip.file("word/document.xml", solidifySignatureLinesInXml(documentXml));
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
