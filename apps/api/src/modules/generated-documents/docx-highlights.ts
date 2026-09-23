import PizZip from "pizzip";

export function stripHighlightsFromDocxXml(xml: string): string {
  return xml
    .replace(/<w:highlight\b[^/]*\/>/g, "")
    .replace(/<w:highlight\b[\s\S]*?<\/w:highlight>/g, "");
}

export function docxXmlHasHighlight(xml: string): boolean {
  return /<w:highlight\b/.test(xml);
}

export function assertNoDocxHighlights(xml: string, label = "document.xml"): void {
  if (docxXmlHasHighlight(xml)) {
    throw new Error(`${label} still contains Word highlighting`);
  }
}

export function stripHighlightsFromDocx(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer);
  for (const name of Object.keys(zip.files)) {
    if (!/^word\/.+\.xml$/.test(name)) continue;
    const file = zip.file(name);
    if (!file || file.dir) continue;
    zip.file(name, stripHighlightsFromDocxXml(file.asText()));
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
