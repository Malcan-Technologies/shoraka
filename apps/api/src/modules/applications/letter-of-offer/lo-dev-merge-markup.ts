/**
 * Temporary LO review markup while templates and data sources are still being wired:
 * yellow highlight on `{snake_case}` merge fields (same as the clean-copy placeholders)
 * and visible `{tag}` text when a field has no value yet.
 *
 * Remove this module and its call sites once every merge field has a signed-off source.
 */

const YELLOW_HIGHLIGHT = `<w:highlight w:val="yellow"/>`;
const MERGE_TAG_RE = /\{[a-z][a-z0-9_]*\}/g;
/** Raw XML insertions — empty means “omit”, not an unset merge field. */
const LEAVE_BLANK_KEYS = new Set(["page_break"]);

function encodeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripHighlight(rPr: string): string {
  return rPr
    .replace(/<w:highlight\b[^/]*\/>/g, "")
    .replace(/<w:highlight\b[\s\S]*?<\/w:highlight>/g, "");
}

function withYellowHighlight(rPr: string): string {
  const base = stripHighlight(rPr);
  if (base.includes("</w:rPr>")) return base.replace("</w:rPr>", `${YELLOW_HIGHLIGHT}</w:rPr>`);
  return `<w:rPr>${YELLOW_HIGHLIGHT}</w:rPr>`;
}

function textRun(text: string, rPr: string, highlight: boolean): string {
  if (!text) return "";
  const pr = highlight ? withYellowHighlight(rPr) : stripHighlight(rPr);
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return `<w:r>${pr}<w:t${space}>${encodeXml(text)}</w:t></w:r>`;
}

type TextSeg = { start: number; end: number; rPr: string };
type Marker = { at: number; xml: string };

function parseParagraphContent(pXml: string): {
  plain: string;
  segs: TextSeg[];
  markers: Marker[];
  fallbackRPr: string;
} {
  const segs: TextSeg[] = [];
  const markers: Marker[] = [];
  let plain = "";
  let fallbackRPr = "";
  const tokenRe =
    /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^/]*\/>|<w:br\b[^/]*\/>|<w:lastRenderedPageBreak\b[^/]*\/>/g;

  for (const runMatch of pXml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)) {
    const run = runMatch[0];
    const rPr = run.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    if (!fallbackRPr && rPr) fallbackRPr = rPr;
    tokenRe.lastIndex = 0;
    let token: RegExpExecArray | null;
    while ((token = tokenRe.exec(run))) {
      if (/^<w:t[\s>]/.test(token[0])) {
        const text = decodeXml(token[1] ?? "");
        const start = plain.length;
        plain += text;
        segs.push({ start, end: plain.length, rPr });
      } else {
        markers.push({ at: plain.length, xml: `<w:r>${rPr}${token[0]}</w:r>` });
      }
    }
  }

  return { plain, segs, markers, fallbackRPr };
}

function rPrAt(segs: TextSeg[], fallbackRPr: string, index: number): string {
  const seg = segs.find((s) => index >= s.start && index < s.end);
  return seg?.rPr || fallbackRPr;
}

function highlightMergeTagsInParagraph(pXml: string): string {
  if (!pXml.includes("{")) return pXml;
  const { plain, segs, markers, fallbackRPr } = parseParagraphContent(pXml);
  const tags = [...plain.matchAll(MERGE_TAG_RE)];
  if (tags.length === 0) return pXml;

  const open = pXml.match(/^<w:p\b[^>]*>/)?.[0] ?? "<w:p>";
  const pPr = pXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const points = [
    ...new Set([
      0,
      ...tags.flatMap((tag) => [tag.index ?? 0, (tag.index ?? 0) + tag[0].length]),
      ...markers.map((marker) => marker.at),
      plain.length,
    ]),
  ].sort((a, b) => a - b);

  const tagAt = new Map(tags.map((tag) => [tag.index ?? 0, tag[0]]));
  let out = `${open}${pPr}`;
  for (let i = 0; i < points.length; i += 1) {
    const at = points[i] ?? 0;
    for (const marker of markers) {
      if (marker.at === at) out += marker.xml;
    }
    const next = points[i + 1];
    if (next == null || next === at) continue;
    const chunk = plain.slice(at, next);
    out += textRun(chunk, rPrAt(segs, fallbackRPr, at), tagAt.get(at) === chunk);
  }
  return `${out}</w:p>`;
}

/** Split `{snake_case}` tags into their own yellow-highlighted Word runs. */
export function highlightMergeTagsInWordXml(xml: string): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, highlightMergeTagsInParagraph);
}

/** Replace empty strings with `{key}` so unset merge fields stay visible in generated docs. */
export function replaceEmptyMergeValuesWithTags(value: unknown, key = ""): unknown {
  if (LEAVE_BLANK_KEYS.has(key)) return value;
  if (typeof value === "string") return value.trim() === "" ? `{${key}}` : value;
  if (Array.isArray(value)) return value.map((item) => replaceEmptyMergeValuesWithTags(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [
        childKey,
        replaceEmptyMergeValuesWithTags(child, childKey),
      ])
    );
  }
  return value;
}
