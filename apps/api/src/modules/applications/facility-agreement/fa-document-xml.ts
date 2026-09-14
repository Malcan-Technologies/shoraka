/** Word emits empty paragraphs as `<w:p .../>`; searching only for `</w:p>` swallows the next one. */
const WORD_PARAGRAPH_RE = /<w:p\b[^>]*\/>|<w:p\b[\s\S]*?<\/w:p>/g;

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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

function compactParagraphText(text: string): string {
  return text.replace(/\t+/g, "").replace(/ +/g, " ").trim();
}

/** Split so later pages can stay on the clean-copy XML (Appendix 1 tags excepted). */
export function splitFacilityAgreementXmlAtSchedule4(xml: string): {
  before: string;
  fromSchedule4: string;
} {
  const matches = [...xml.matchAll(WORD_PARAGRAPH_RE)];
  for (const match of matches) {
    const compact = compactParagraphText(paragraphPlainText(match[0]));
    if (compact.startsWith("SCHEDULE 4") && match.index != null) {
      return {
        before: xml.slice(0, match.index),
        fromSchedule4: xml.slice(match.index),
      };
    }
  }
  throw new Error("Could not find SCHEDULE 4 heading");
}
