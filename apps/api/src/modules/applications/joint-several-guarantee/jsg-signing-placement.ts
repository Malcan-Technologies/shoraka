import path from "path";
import { createRequire } from "module";
import type { SigningCloudSignField } from "./jsg-signing-signsets";

const requireFromPlacement = createRequire(__filename);

export type JsgPdfTextItem = {
  pageindex: number;
  x: number;
  yTop: number;
  width: number;
  height: number;
  text: string;
  pageHeight: number;
  pageWidth: number;
};

export type JsgPdfLine = JsgPdfTextItem;

export type JsgSignatureSlot = {
  kind: "individual" | "corporate";
  name: string;
  pageindex: number;
  top: number;
  left: number;
  height: number;
  width: number;
};

export class JsgSigningLayoutError extends Error {
  readonly code = "JSG_SIGNING_LAYOUT";

  constructor(message: string) {
    super(message);
    this.name = "JsgSigningLayoutError";
  }
}

const Y_LINE_TOLERANCE = 3;
const COLUMN_GAP = 40;
const SAME_COLUMN_X = 50;
const LINE_SEARCH_BELOW = 55;
const LINE_SEARCH_ABOVE = 50;

type PdfjsUtil = { transform: (m1: number[], m2: number[]) => number[] };

type PdfjsModule = {
  getDocument: (src: {
    data: Uint8Array;
    disableWorker: boolean;
    isEvalSupported: boolean;
    verbosity: number;
    standardFontDataUrl: string;
    cMapUrl: string;
    cMapPacked: boolean;
  }) => { promise: Promise<PdfjsDocument> };
  Util: PdfjsUtil;
  GlobalWorkerOptions: { workerSrc: string };
};

type PdfjsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfjsPage>;
  destroy: () => Promise<void>;
};

type PdfjsPage = {
  getViewport: (params: { scale: number }) => { transform: number[]; height: number; width: number };
  getTextContent: () => Promise<{
    items: Array<{ str?: string; transform: number[]; width: number; height: number }>;
  }>;
};

function loadPdfjs(): PdfjsModule {
  return requireFromPlacement("pdfjs-dist/legacy/build/pdf.js") as PdfjsModule;
}

function configurePdfjsWorker(pdfjs: PdfjsModule): void {
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = requireFromPlacement.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.js"
    );
  }
}

function pdfjsAssetUrl(folder: "standard_fonts" | "cmaps"): string {
  const root = path.dirname(requireFromPlacement.resolve("pdfjs-dist/package.json"));
  return `${path.join(root, folder)}/`;
}

function normalizeJsgSignerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function compactLineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isDotsLine(text: string): boolean {
  return /^\.{8,}$/.test(text.replace(/\s+/g, ""));
}

function isUnderscoreLine(text: string): boolean {
  return /^_{8,}$/.test(text.replace(/\s+/g, ""));
}

function sameColumn(a: { x: number }, b: { x: number }): boolean {
  return Math.abs(a.x - b.x) < SAME_COLUMN_X;
}

function joinClusterText(cluster: JsgPdfTextItem[]): string {
  const sorted = [...cluster].sort((a, b) => a.x - b.x);
  let joined = sorted[0]?.text ?? "";
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (!prev || !cur) continue;
    const gap = cur.x - (prev.x + prev.width);
    joined += gap > 1.5 ? ` ${cur.text}` : cur.text;
  }
  return compactLineText(joined);
}

function splitColumnClusters(cluster: JsgPdfTextItem[]): JsgPdfTextItem[][] {
  const sorted = [...cluster].sort((a, b) => a.x - b.x);
  const pageCenter = (sorted[0]?.pageWidth ?? 595) / 2;
  const groups: JsgPdfTextItem[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    const gap = prev ? item.x - (prev.x + prev.width) : 0;
    const crossesGutter = Boolean(prev && prev.x < pageCenter - 20 && item.x > pageCenter + 20);
    if (!last || !prev || gap >= COLUMN_GAP || crossesGutter) {
      groups.push([item]);
    } else {
      last.push(item);
    }
  }
  return groups;
}

/** Rebuild reading-order lines, splitting two-column signature tables. */
export function linesFromJsgPdfItems(items: JsgPdfTextItem[]): JsgPdfLine[] {
  const byPage = new Map<number, JsgPdfTextItem[]>();
  for (const item of items) {
    if (!item.text.trim()) continue;
    const list = byPage.get(item.pageindex) ?? [];
    list.push(item);
    byPage.set(item.pageindex, list);
  }

  const lines: JsgPdfLine[] = [];
  for (const pageItems of byPage.values()) {
    const sorted = [...pageItems].sort((a, b) => a.yTop - b.yTop || a.x - b.x);
    const yClusters: JsgPdfTextItem[][] = [];
    for (const item of sorted) {
      const last = yClusters[yClusters.length - 1];
      if (last && Math.abs((last[0]?.yTop ?? 0) - item.yTop) <= Y_LINE_TOLERANCE) {
        last.push(item);
      } else {
        yClusters.push([item]);
      }
    }
    for (const yCluster of yClusters) {
      for (const column of splitColumnClusters(yCluster)) {
        const first = column[0];
        const last = column[column.length - 1];
        if (!first || !last) continue;
        lines.push({
          pageindex: first.pageindex,
          x: first.x,
          yTop: Math.min(...column.map((entry) => entry.yTop)),
          width: last.x + last.width - first.x,
          height: Math.max(...column.map((entry) => entry.height)),
          text: joinClusterText(column),
          pageHeight: first.pageHeight,
          pageWidth: first.pageWidth,
        });
      }
    }
  }

  return lines.sort((a, b) => a.pageindex - b.pageindex || a.yTop - b.yTop || a.x - b.x);
}

function pageHasExactLine(lines: JsgPdfLine[], pageindex: number, needle: string): boolean {
  const expected = compactLineText(needle).toLowerCase();
  return lines.some(
    (line) => line.pageindex === pageindex && compactLineText(line.text).toLowerCase() === expected
  );
}

function executionPageWindow(lines: JsgPdfLine[]): { start: number; end: number } | null {
  const pages = [...new Set(lines.map((line) => line.pageindex))].sort((a, b) => a - b);
  const start = pages.find((page) => pageHasExactLine(lines, page, "EXECUTION PAGE"));
  if (start == null) return null;
  const operator = pages.find(
    (page) => page >= start && pageHasExactLine(lines, page, "OPERATOR")
  );
  const schedule = pages.find(
    (page) => page >= start && pageHasExactLine(lines, page, "SCHEDULE 1")
  );
  const endExclusive = operator ?? schedule ?? pages[pages.length - 1]! + 1;
  return { start, end: endExclusive };
}

function lineBelow(line: JsgPdfLine, lines: JsgPdfLine[]): JsgPdfLine | undefined {
  return lines
    .filter(
      (candidate) =>
        candidate.pageindex === line.pageindex &&
        sameColumn(candidate, line) &&
        candidate.yTop > line.yTop &&
        candidate.yTop - line.yTop <= LINE_SEARCH_BELOW
    )
    .sort((a, b) => a.yTop - b.yTop)[0];
}

function dotsAbove(line: JsgPdfLine, lines: JsgPdfLine[]): JsgPdfLine | undefined {
  return lines
    .filter(
      (candidate) =>
        candidate.pageindex === line.pageindex &&
        sameColumn(candidate, line) &&
        candidate.yTop < line.yTop &&
        line.yTop - candidate.yTop <= LINE_SEARCH_ABOVE &&
        isDotsLine(candidate.text)
    )
    .sort((a, b) => b.yTop - a.yTop)[0];
}

function fieldFromSignatureLine(line: JsgPdfLine): Pick<
  JsgSignatureSlot,
  "pageindex" | "top" | "left" | "height" | "width"
> {
  // Blank rows above the dotted line give ~36pt of room; sit the box on the stroke.
  const height = 36;
  const width = Math.max(120, Math.min(240, Math.round(line.width) || 120));
  return {
    pageindex: line.pageindex,
    top: Math.max(24, Math.round(line.yTop - height + 6)),
    left: Math.max(20, Math.round(line.x)),
    height,
    width,
  };
}

function individualNameFromLabel(label: JsgPdfLine, lines: JsgPdfLine[]): string {
  const fullName = lines
    .filter(
      (candidate) =>
        candidate.pageindex === label.pageindex &&
        sameColumn(candidate, label) &&
        candidate.yTop > label.yTop &&
        candidate.yTop - label.yTop <= LINE_SEARCH_BELOW * 1.4
    )
    .sort((a, b) => a.yTop - b.yTop)
    .map((candidate) => compactLineText(candidate.text).match(/^Full Name:\s*(.*)$/i)?.[1]?.trim())
    .find((name) => name && name.length > 0);
  return fullName ?? "";
}

function isWitnessOrOperatorLabel(text: string): boolean {
  const value = compactLineText(text).toLowerCase();
  return (
    value === "signature of witness" ||
    value === "name:" ||
    value === "full name:" ||
    value.startsWith("nric") ||
    value.startsWith("designation") ||
    value.startsWith("date:")
  );
}

/** CA slots on individual dotted lines and corporate underscores, never Operator/Schedule 1. */
export function collectJsgSignatureSlots(items: JsgPdfTextItem[]): JsgSignatureSlot[] {
  const lines = linesFromJsgPdfItems(items);
  const window = executionPageWindow(lines);
  if (!window) {
    throw new JsgSigningLayoutError("JSG PDF is missing the EXECUTION PAGE.");
  }

  const executionLines = lines.filter(
    (line) => line.pageindex >= window.start && line.pageindex < window.end
  );
  const slots: JsgSignatureSlot[] = [];

  for (const line of executionLines) {
    if (compactLineText(line.text).toLowerCase() !== "signature of guarantor") continue;
    const stroke = dotsAbove(line, executionLines) ?? line;
    slots.push({
      kind: "individual",
      name: individualNameFromLabel(line, executionLines),
      ...fieldFromSignatureLine(stroke),
    });
  }

  for (const line of executionLines) {
    if (!isUnderscoreLine(line.text)) continue;
    const below = lineBelow(line, executionLines);
    if (!below || isWitnessOrOperatorLabel(below.text)) continue;
    slots.push({
      kind: "corporate",
      name: compactLineText(below.text),
      ...fieldFromSignatureLine(line),
    });
  }

  return slots.sort((a, b) => a.pageindex - b.pageindex || a.top - b.top || a.left - b.left);
}

export function matchJsgSignersToSlots(
  signerNames: string[],
  slots: JsgSignatureSlot[]
): SigningCloudSignField[][] {
  const unused = slots.map((slot) => ({ ...slot, used: false }));
  const signsets: SigningCloudSignField[][] = [];

  for (const signerName of signerNames) {
    const needle = normalizeJsgSignerName(signerName);
    if (!needle) {
      throw new JsgSigningLayoutError("JSG signer is missing a name.");
    }
    const slot = unused.find(
      (entry) => !entry.used && normalizeJsgSignerName(entry.name) === needle
    );
    if (!slot) {
      const available = slots.map((entry) => entry.name).filter(Boolean).join(", ") || "(none)";
      throw new JsgSigningLayoutError(
        `Could not place JSG signature for "${signerName}" on an execution line. Found: ${available}.`
      );
    }
    slot.used = true;
    signsets.push([
      {
        fieldtype: "sign",
        top: slot.top,
        left: slot.left,
        height: slot.height,
        width: slot.width,
        pageindex: slot.pageindex,
      },
    ]);
  }

  return signsets;
}

export async function extractPdfTextItems(buffer: Buffer): Promise<JsgPdfTextItem[]> {
  const pdfjs = loadPdfjs();
  configurePdfjsWorker(pdfjs);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    isEvalSupported: false,
    verbosity: 0,
    standardFontDataUrl: pdfjsAssetUrl("standard_fonts"),
    cMapUrl: pdfjsAssetUrl("cmaps"),
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  const items: JsgPdfTextItem[] = [];
  try {
    for (let pageindex = 1; pageindex <= pdf.numPages; pageindex += 1) {
      const page = await pdf.getPage(pageindex);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      for (const raw of content.items) {
        if (typeof raw.str !== "string" || !raw.str) continue;
        const tx = pdfjs.Util.transform(viewport.transform, raw.transform);
        items.push({
          pageindex,
          x: tx[4] ?? 0,
          yTop: tx[5] ?? 0,
          width: raw.width,
          height: raw.height,
          text: raw.str,
          pageHeight: viewport.height,
          pageWidth: viewport.width,
        });
      }
    }
  } finally {
    await pdf.destroy();
  }
  return items;
}

/** SigningCloud signsets on JSG execution signature lines (not Schedule 1). */
export async function buildJsgSigningCloudSignsetsFromPdf(
  pdfBuffer: Buffer,
  signerNames: string[]
): Promise<SigningCloudSignField[][]> {
  if (signerNames.length === 0) return [];
  try {
    const items = await extractPdfTextItems(pdfBuffer);
    const slots = collectJsgSignatureSlots(items);
    return matchJsgSignersToSlots(signerNames, slots);
  } catch (err) {
    if (err instanceof JsgSigningLayoutError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new JsgSigningLayoutError(`Could not read JSG signature lines from the PDF (${detail}).`);
  }
}
