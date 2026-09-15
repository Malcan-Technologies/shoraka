import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  automaticContractKeywordLimitIssue,
  automaticSignerKeywordCollisionIssue,
  automaticSigningKeywordForSlot,
  defaultAutomaticKeywordOwners,
  documentExecutionSlotLabel,
  documentExecutionSlotsForPackageKey,
  executionRoleHasSignDate,
  isOperatorDocumentWitnessRole,
  type AutomaticSignerKeywordOwner,
  type DocumentExecutionRepeatCounts,
  type OperatorDocumentExecutionRole,
  type OperatorDocumentExecutionSlotRef,
} from "@cashsouk/types";
import {
  extractPdfTextItems,
  linesFromJsgPdfItems,
  type JsgPdfLine,
  type JsgPdfTextItem,
} from "../applications/joint-several-guarantee/jsg-signing-placement";
import {
  dateFieldFromLine,
  findSignerDateLabel,
  isAutomaticSigningKeywordLine,
  isSignatureStrokeLine,
  LAYOUT_DETECTED_DATE_FIELD,
  LAYOUT_DETECTED_SIGN_FIELD,
  signatureFieldFromLine,
  type SigningCloudSignField,
} from "./signature-field-geometry";

export class AutomaticSigningKeywordError extends Error {
  readonly code = "AUTOMATIC_SIGNING_KEYWORD";

  constructor(message: string) {
    super(message);
    this.name = "AutomaticSigningKeywordError";
  }
}

const SAME_COLUMN_X = 50;
const LINE_SEARCH_BELOW = 55;
/** Ignore a `:` that belongs to the other execution column. */
const HANGING_COLON_MAX_DX = 100;
const KEYWORD_FONT_SIZE = 8;
/** `/signature/auto` paints dd/MM/yyyy on the keyword run; body-sized stamp. */
const AUTO_DATE_STAMP_FONT_SIZE = 10;
const AUTO_DATE_STAMP_SAMPLE = "00/00/0000";
/** Sit the centred stamp in the value column, just after the hanging colon. */
const AUTO_DATE_STAMP_RIGHT_NUDGE = 20;
/** `/signature/auto` sits too far right of the stroke; pull the image onto the line. */
const AUTO_SIGN_STAMP_LEFT_NUDGE = 24;
/** Fallback when a role still has a single stamp sitting above its marker. */
const STROKE_SEARCH_ABOVE = 110;

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isStroke(text: string): boolean {
  return isSignatureStrokeLine(text);
}

function isDoaAssignorHeading(text: string): boolean {
  const value = compact(text).toLowerCase();
  if (value.includes("minimum of two")) return true;
  if (value.startsWith("assignor") && value.includes("authorised signatories")) return true;
  return /^assignor\s*[–-]/.test(value);
}

/** Short execution heading above the two SSP signature lines; [SSP] is only the party marker below them. */
function isDoaSspExecutionHeading(text: string): boolean {
  return compact(text) === "SHORAKA SUYULA PLATFORM";
}

function headingMatcher(role: OperatorDocumentExecutionRole): (text: string) => boolean {
  if (role === "FA_INVESTOR") return (text) => compact(text) === "INVESTOR";
  if (role === "FA_AGENT") return (text) => compact(text) === "AGENT";
  if (role === "JSG_OPERATOR") return (text) => compact(text) === "OPERATOR";
  if (role === "DOA_SSP") return isDoaSspExecutionHeading;
  throw new AutomaticSigningKeywordError(`Unsupported automatic-signing heading for ${role}.`);
}

function blockEndMatcher(role: OperatorDocumentExecutionRole): ((text: string) => boolean) | null {
  if (role === "FA_INVESTOR") return (text) => compact(text) === "AGENT";
  if (role === "FA_AGENT") return (text) => compact(text) === "ISSUER";
  if (role === "DOA_SSP") return isDoaAssignorHeading;
  return null;
}

function isAfter(line: JsgPdfLine, origin: JsgPdfLine): boolean {
  return (
    line.pageindex > origin.pageindex ||
    (line.pageindex === origin.pageindex && line.yTop > origin.yTop)
  );
}

function isBefore(line: JsgPdfLine, origin: JsgPdfLine): boolean {
  return (
    line.pageindex < origin.pageindex ||
    (line.pageindex === origin.pageindex && line.yTop < origin.yTop)
  );
}

function sameColumn(a: { x: number }, b: { x: number }): boolean {
  return Math.abs(a.x - b.x) < SAME_COLUMN_X;
}

function lineBelow(line: JsgPdfLine, lines: readonly JsgPdfLine[]): JsgPdfLine | undefined {
  return lines
    .filter(
      (candidate) =>
        candidate.pageindex === line.pageindex &&
        sameColumn(candidate, line) &&
        candidate.yTop > line.yTop &&
        candidate.yTop - line.yTop <= LINE_SEARCH_BELOW &&
        !isAutomaticSigningKeywordLine(candidate.text)
    )
    .sort((a, b) => a.yTop - b.yTop)[0];
}

function isSignatoryNameLabel(text: string): boolean {
  const value = compact(text);
  if (/^name of witness/i.test(value)) return false;
  return /^name(\s*:.*)?$/i.test(value);
}

function isSignatoryNameStroke(stroke: JsgPdfLine, lines: readonly JsgPdfLine[]): boolean {
  const below = lineBelow(stroke, lines);
  if (!below) return false;
  return isSignatoryNameLabel(below.text);
}

export type AutomaticKeywordAnchor = {
  roleKey: OperatorDocumentExecutionRole;
  slotIndex: number;
  keyword: string;
  pageindex: number;
  x: number;
  yTop: number;
  width: number;
  pageWidth: number;
  pageHeight: number;
  date?: {
    pageindex: number;
    x: number;
    yTop: number;
    width: number;
    pageWidth: number;
    pageHeight: number;
  };
};

function ownerForSlot(
  owners: readonly AutomaticSignerKeywordOwner[],
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): AutomaticSignerKeywordOwner | undefined {
  return owners.find((owner) =>
    owner.placements.some(
      (placement) => placement.roleKey === roleKey && placement.slotIndex === slotIndex
    )
  );
}

function countKeywordOccurrences(text: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`${escaped}(?![A-Z0-9_])`, "g")) ?? []).length;
}

function keywordPresentNear(
  items: readonly JsgPdfTextItem[],
  keyword: string,
  pageindex: number,
  x: number,
  yTop: number
): boolean {
  return items.some(
    (item) =>
      item.pageindex === pageindex &&
      Math.abs(item.x - x) < 240 &&
      Math.abs(item.yTop - yTop) < 18 &&
      item.text.includes(keyword)
  );
}

export function automaticSlotKey(
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): string {
  return `${roleKey}:${slotIndex}`;
}

export function signFieldFromAutomaticAnchor(anchor: AutomaticKeywordAnchor): SigningCloudSignField {
  return signatureFieldFromLine({
    pageindex: anchor.pageindex,
    x: anchor.x,
    yTop: anchor.yTop,
    width: anchor.width,
    pageWidth: anchor.pageWidth,
    pageHeight: anchor.pageHeight,
  });
}

export async function buildAutomaticSigningCloudSignsetsFromPdf(
  pdfBuffer: Buffer,
  documentKey: string,
  repeats?: DocumentExecutionRepeatCounts | null
): Promise<Map<string, SigningCloudSignField[]>> {
  const slots = documentExecutionSlotsForPackageKey(documentKey, repeats);
  if (slots.length === 0) return new Map();
  const items = await extractPdfTextItems(pdfBuffer);
  const anchors = findAutomaticKeywordAnchors(items, slots);
  return new Map(
    anchors.map((anchor) => {
      if (executionRoleHasSignDate(anchor.roleKey) && !anchor.date) {
        throw new AutomaticSigningKeywordError(
          `PDF is missing a Date line for ${documentExecutionSlotLabel(
            anchor.roleKey,
            anchor.slotIndex
          )}.`
        );
      }
      return [automaticSlotKey(anchor.roleKey, anchor.slotIndex), [signFieldFromAutomaticAnchor(anchor)]] as const;
    })
  );
}

function firstStrokeAfter(
  origin: JsgPdfLine,
  lines: readonly JsgPdfLine[],
  end?: JsgPdfLine
): JsgPdfLine | undefined {
  return lines
    .filter(
      (line) =>
        isStroke(line.text) &&
        isAfter(line, origin) &&
        (end == null || isBefore(line, end))
    )
    .sort((a, b) => a.pageindex - b.pageindex || a.yTop - b.yTop || a.x - b.x)[0];
}

function strokeAbove(origin: JsgPdfLine, lines: readonly JsgPdfLine[]): JsgPdfLine | undefined {
  return lines
    .filter(
      (candidate) =>
        candidate.pageindex === origin.pageindex &&
        sameColumn(candidate, origin) &&
        isStroke(candidate.text) &&
        candidate.yTop < origin.yTop &&
        origin.yTop - candidate.yTop <= STROKE_SEARCH_ABOVE
    )
    .sort((a, b) => b.yTop - a.yTop)[0];
}

function trailingSignatureStroke(line: JsgPdfLine): JsgPdfLine | undefined {
  if (isStroke(line.text)) return line;
  const match = line.text.match(/([_\u2014\u2500\u2501]{8,})\s*$/);
  if (!match || match.index == null) return undefined;
  const strokeText = match[1] ?? "";
  if (!isStroke(strokeText)) return undefined;
  const ratio = match.index / Math.max(line.text.length, 1);
  return {
    ...line,
    x: line.x + line.width * ratio,
    width: Math.max(40, line.width * (1 - ratio)),
    text: strokeText,
  };
}

function signatoryStrokesInBlock(
  heading: JsgPdfLine,
  roleKey: OperatorDocumentExecutionRole,
  lines: readonly JsgPdfLine[]
): JsgPdfLine[] {
  const endMatch = blockEndMatcher(roleKey);
  const end = endMatch
    ? lines.find((line) => endMatch(line.text) && isAfter(line, heading))
    : roleKey === "JSG_OPERATOR"
      ? lines.find((line) => compact(line.text) === "SCHEDULE 1" && isAfter(line, heading))
      : undefined;
  if (roleKey === "JSG_OPERATOR") {
    const witnessKeys = new Set(
      lines
        .filter(
          (line) =>
            compact(line.text).toLowerCase() === "signature of witness" &&
            isAfter(line, heading) &&
            (end == null || isBefore(line, end))
        )
        .map((marker) => strokeAbove(marker, lines))
        .filter((line): line is JsgPdfLine => Boolean(line))
        .map(strokeKey)
    );
    return lines
      .filter(
        (line) =>
          isStroke(line.text) &&
          isAfter(line, heading) &&
          (end == null || isBefore(line, end)) &&
          !witnessKeys.has(strokeKey(line))
      )
      .sort((a, b) => a.pageindex - b.pageindex || a.yTop - b.yTop || a.x - b.x);
  }
  if (roleKey === "FA_INVESTOR" || roleKey === "FA_AGENT") {
    return lines
      .filter((line) => isAfter(line, heading) && (end == null || isBefore(line, end)))
      .map(trailingSignatureStroke)
      .filter((line): line is JsgPdfLine => Boolean(line))
      .filter((stroke) => {
        const below = lineBelow(stroke, lines);
        return !below || !/^name of witness/i.test(compact(below.text));
      })
      .sort((a, b) => a.pageindex - b.pageindex || a.yTop - b.yTop || a.x - b.x);
  }
  if (roleKey === "DOA_SSP") {
    return lines
      .filter((line) => isAfter(line, heading) && (end == null || isBefore(line, end)))
      .map(trailingSignatureStroke)
      .filter((line): line is JsgPdfLine => Boolean(line))
      .filter((stroke) => isSignatoryNameStroke(stroke, lines))
      .sort((a, b) => a.pageindex - b.pageindex || a.yTop - b.yTop || a.x - b.x);
  }
  return lines
    .filter(
      (line) =>
        isStroke(line.text) &&
        isAfter(line, heading) &&
        (end == null || isBefore(line, end)) &&
        isSignatoryNameStroke(line, lines)
    )
    .sort((a, b) => a.pageindex - b.pageindex || a.yTop - b.yTop || a.x - b.x);
}

function strokeKey(line: JsgPdfLine): string {
  return `${line.pageindex}:${line.yTop}:${line.x}`;
}

function isWitnessMarker(roleKey: OperatorDocumentExecutionRole, text: string): boolean {
  const value = compact(text);
  if (roleKey === "FA_ISSUER_WITNESS") return /^name of witness/i.test(value);
  if (roleKey === "JSG_GUARANTOR_WITNESS" || roleKey === "JSG_OPERATOR_WITNESS") {
    return value.toLowerCase() === "signature of witness";
  }
  if (roleKey === "DOA_ASSIGNOR_WITNESS") return /\[witness\]/i.test(value);
  return false;
}

function faIssuerHeading(lines: readonly JsgPdfLine[]): JsgPdfLine | undefined {
  let seenWitness = false;
  let seenAgent = false;
  for (const line of lines) {
    const value = compact(line.text);
    if (value.startsWith("IN WITNESS WHEREOF the parties hereto have caused this Agreement")) {
      seenWitness = true;
    }
    if (seenWitness && value === "AGENT") seenAgent = true;
    if (seenAgent && value === "ISSUER") return line;
  }
  return undefined;
}

function witnessBlockBounds(
  roleKey: OperatorDocumentExecutionRole,
  lines: readonly JsgPdfLine[]
): { start: JsgPdfLine; end?: JsgPdfLine } {
  if (roleKey === "FA_ISSUER_WITNESS") {
    const start = faIssuerHeading(lines);
    if (!start) {
      throw new AutomaticSigningKeywordError(
        "PDF is missing the ISSUER execution heading for the CashSouk issuer witness."
      );
    }
    const end = lines.find(
      (line) => compact(line.text) === "SCHEDULE 1" && isAfter(line, start)
    );
    return { start, end };
  }
  if (roleKey === "JSG_GUARANTOR_WITNESS") {
    const start =
      lines.find((line) => compact(line.text) === "EXECUTION PAGE") ??
      lines.find((line) => compact(line.text).startsWith("IN WITNESS WHEREOF"));
    if (!start) {
      throw new AutomaticSigningKeywordError(
        "PDF is missing the JSG execution page for the guarantor witness."
      );
    }
    const end = lines.find((line) => compact(line.text) === "OPERATOR" && isAfter(line, start));
    return { start, end };
  }
  if (roleKey === "JSG_OPERATOR_WITNESS") {
    const start = lines.find((line) => compact(line.text) === "OPERATOR");
    if (!start) {
      throw new AutomaticSigningKeywordError(
        "PDF is missing the OPERATOR heading for the CashSouk operator witness."
      );
    }
    const end = lines.find((line) => compact(line.text) === "SCHEDULE 1" && isAfter(line, start));
    return { start, end };
  }
  const start = lines.find((line) => isDoaAssignorHeading(line.text));
  if (!start) {
    throw new AutomaticSigningKeywordError(
      "PDF is missing the ASSIGNOR execution heading for the CashSouk assignor witness."
    );
  }
  return { start };
}

function witnessStrokes(
  roleKey: OperatorDocumentExecutionRole,
  lines: readonly JsgPdfLine[]
): JsgPdfLine[] {
  const { start, end } = witnessBlockBounds(roleKey, lines);
  const markers = lines
    .filter(
      (line) =>
        isWitnessMarker(roleKey, line.text) &&
        isAfter(line, start) &&
        (end == null || isBefore(line, end))
    )
    .sort((a, b) => a.pageindex - b.pageindex || a.yTop - b.yTop || a.x - b.x);
  return markers
    .map((marker) => strokeAbove(marker, lines))
    .filter((line): line is JsgPdfLine => Boolean(line));
}

function sameRowColon(
  origin: JsgPdfLine,
  glyphs: readonly JsgPdfTextItem[]
): JsgPdfTextItem | undefined {
  return glyphs.find(
    (item) =>
      item.pageindex === origin.pageindex &&
      Math.abs(item.yTop - origin.yTop) <= 3 &&
      compact(item.text) === ":" &&
      item.x > origin.x &&
      item.x - origin.x <= HANGING_COLON_MAX_DX
  );
}

function dateSearchOptions(stroke: JsgPdfLine, nextStroke?: JsgPdfLine) {
  return {
    sameColumnDelta: SAME_COLUMN_X,
    maxBelow: LINE_SEARCH_BELOW + 50,
    beforeYTop:
      nextStroke && nextStroke.pageindex === stroke.pageindex ? nextStroke.yTop : undefined,
  };
}

function snapDateKeywordLeft(dateLine: JsgPdfLine, left: number): number {
  return Math.max(
    LAYOUT_DETECTED_DATE_FIELD.minLeft,
    Math.round(dateLine.x + LAYOUT_DETECTED_DATE_FIELD.leftGap),
    left
  );
}

function afterDateLabelLeft(dateLine: JsgPdfLine): number {
  const text = compact(dateLine.text);
  if (/^date\s*:?$/i.test(text)) {
    const estimated = Math.min(Math.max(dateLine.width, 0), Math.max(24, text.length * 5));
    return Math.round(dateLine.x + estimated + LAYOUT_DETECTED_DATE_FIELD.leftGap);
  }
  return dateFieldFromLine(dateLine).left;
}

/** One hanging-tab X for every Date in a stacked execution column. */
function hangingTabLeft(
  strokes: readonly JsgPdfLine[],
  lines: readonly JsgPdfLine[],
  glyphs: readonly JsgPdfTextItem[],
  columnStroke?: JsgPdfLine
): number | undefined {
  const column = columnStroke
    ? strokes.filter(
        (stroke) =>
          stroke.pageindex === columnStroke.pageindex &&
          Math.abs(stroke.x - columnStroke.x) <= SAME_COLUMN_X
      )
    : strokes;
  const tabs: number[] = [];
  for (let index = 0; index < column.length; index += 1) {
    const stroke = column[index];
    if (!stroke) continue;
    const dateLine = findSignerDateLabel(
      { pageindex: stroke.pageindex, x: stroke.x, yTop: stroke.yTop },
      lines,
      dateSearchOptions(stroke, column[index + 1])
    );
    if (!dateLine) continue;
    const colon = sameRowColon(dateLine, glyphs);
    if (colon) tabs.push(colon.x);
  }
  if (tabs.length === 0) return undefined;
  const sorted = [...tabs].sort((a, b) => a - b);
  const tab = sorted[Math.floor((sorted.length - 1) / 2)];
  if (tab == null) return undefined;
  return Math.round(tab + LAYOUT_DETECTED_DATE_FIELD.leftGap);
}

function dateKeywordLeft(
  dateLine: JsgPdfLine,
  glyphs: readonly JsgPdfTextItem[],
  sharedTabLeft?: number
): number {
  if (sharedTabLeft != null) return snapDateKeywordLeft(dateLine, sharedTabLeft);
  const colon = sameRowColon(dateLine, glyphs);
  if (colon) {
    return snapDateKeywordLeft(
      dateLine,
      Math.round(colon.x + LAYOUT_DETECTED_DATE_FIELD.leftGap)
    );
  }
  return snapDateKeywordLeft(dateLine, afterDateLabelLeft(dateLine));
}

function dateGeometryForStroke(
  stroke: JsgPdfLine,
  lines: readonly JsgPdfLine[],
  glyphs: readonly JsgPdfTextItem[],
  nextStroke?: JsgPdfLine,
  sharedTabLeft?: number
): AutomaticKeywordAnchor["date"] {
  const dateLine = findSignerDateLabel(
    { pageindex: stroke.pageindex, x: stroke.x, yTop: stroke.yTop },
    lines,
    dateSearchOptions(stroke, nextStroke)
  );
  if (!dateLine) return undefined;
  const field = dateFieldFromLine(dateLine);
  return {
    pageindex: dateLine.pageindex,
    x: dateKeywordLeft(dateLine, glyphs, sharedTabLeft),
    yTop: dateLine.yTop,
    width: field.width,
    pageWidth: dateLine.pageWidth,
    pageHeight: dateLine.pageHeight,
  };
}

function alignDateKeywordsInColumn(
  anchors: AutomaticKeywordAnchor[]
): AutomaticKeywordAnchor[] {
  const collected = new Map<string, number[]>();
  for (const anchor of anchors) {
    if (!anchor.date) continue;
    const key = `${anchor.roleKey}:${anchor.pageindex}:${Math.round(anchor.x / SAME_COLUMN_X)}`;
    const xs = collected.get(key) ?? [];
    xs.push(anchor.date.x);
    collected.set(key, xs);
  }
  const shared = new Map<string, number>();
  for (const [key, xs] of collected) {
    if (xs.length < 2) continue;
    shared.set(key, Math.min(...xs));
  }
  if (shared.size === 0) return anchors;
  return anchors.map((anchor) => {
    if (!anchor.date) return anchor;
    const key = `${anchor.roleKey}:${anchor.pageindex}:${Math.round(anchor.x / SAME_COLUMN_X)}`;
    const x = shared.get(key);
    if (x == null || x === anchor.date.x) return anchor;
    return { ...anchor, date: { ...anchor.date, x } };
  });
}

function anchorFromStroke(
  slot: OperatorDocumentExecutionSlotRef,
  stroke: JsgPdfLine | undefined,
  fallback: JsgPdfLine,
  date?: AutomaticKeywordAnchor["date"]
): AutomaticKeywordAnchor {
  return {
    roleKey: slot.roleKey,
    slotIndex: slot.slotIndex,
    keyword: automaticSigningKeywordForSlot(slot.roleKey, slot.slotIndex),
    pageindex: stroke?.pageindex ?? fallback.pageindex,
    x: stroke?.x ?? fallback.x,
    yTop: stroke?.yTop ?? fallback.yTop + 24,
    width: stroke?.width ?? fallback.width,
    pageWidth: fallback.pageWidth,
    pageHeight: fallback.pageHeight,
    ...(date ? { date } : {}),
  };
}

export function findAutomaticKeywordAnchors(
  items: readonly JsgPdfTextItem[],
  slots: readonly OperatorDocumentExecutionSlotRef[]
): AutomaticKeywordAnchor[] {
  const lines = linesFromJsgPdfItems([...items]);
  const usedStrokes = new Set<string>();
  const representativeSlots = slots.filter(
    (slot) => !isOperatorDocumentWitnessRole(slot.roleKey)
  );
  const witnessSlots = slots.filter((slot) => isOperatorDocumentWitnessRole(slot.roleKey));

  const representativeAnchors = representativeSlots.map((slot) => {
    const isHeading = headingMatcher(slot.roleKey);
    const heading =
      slot.roleKey === "FA_INVESTOR" || slot.roleKey === "FA_AGENT"
        ? (() => {
            let seenWitness = false;
            return lines.find((line) => {
              const value = compact(line.text);
              if (value.startsWith("IN WITNESS WHEREOF the parties hereto have caused this Agreement")) {
                seenWitness = true;
              }
              return seenWitness && isHeading(line.text);
            });
          })()
        : lines.find((line) => isHeading(line.text));
    if (!heading) {
      throw new AutomaticSigningKeywordError(
        `PDF is missing the ${slot.roleKey} execution heading for automatic signing.`
      );
    }
    const needed = Math.max(
      representativeSlots.filter((item) => item.roleKey === slot.roleKey).length,
      slot.slotIndex
    );
    const endMatch = blockEndMatcher(slot.roleKey);
    const end = endMatch
      ? lines.find((line) => endMatch(line.text) && isAfter(line, heading))
      : undefined;
    const strokes =
      needed > 1
        ? signatoryStrokesInBlock(heading, slot.roleKey, lines)
        : [strokeAbove(heading, lines) ?? firstStrokeAfter(heading, lines, end)].filter(
            (line): line is JsgPdfLine => Boolean(line)
          );
    if (strokes.length !== needed) {
      throw new AutomaticSigningKeywordError(
        `PDF is missing ${needed} signature lines for ${documentExecutionSlotLabel(
          slot.roleKey,
          slot.slotIndex
        )}.`
      );
    }
    const stroke = strokes[slot.slotIndex - 1];
    if (stroke) {
      const key = strokeKey(stroke);
      if (usedStrokes.has(key)) {
        throw new AutomaticSigningKeywordError(
          `PDF has an ambiguous signature line for ${documentExecutionSlotLabel(
            slot.roleKey,
            slot.slotIndex
          )}.`
        );
      }
      usedStrokes.add(key);
    }
    const tabLeft = hangingTabLeft(strokes, lines, items, stroke);
    const date =
      stroke && executionRoleHasSignDate(slot.roleKey)
        ? dateGeometryForStroke(stroke, lines, items, strokes[slot.slotIndex], tabLeft)
        : undefined;
    return anchorFromStroke(slot, stroke, heading, date);
  });

  const witnessAnchors = witnessSlots.map((slot) => {
    const strokes = witnessStrokes(slot.roleKey, lines);
    const needed = Math.max(
      witnessSlots.filter((item) => item.roleKey === slot.roleKey).length,
      slot.slotIndex
    );
    if (strokes.length !== needed) {
      throw new AutomaticSigningKeywordError(
        `PDF is missing ${needed} signature lines for ${documentExecutionSlotLabel(
          slot.roleKey,
          slot.slotIndex
        )}.`
      );
    }
    const stroke = strokes[slot.slotIndex - 1];
    if (stroke) {
      const key = strokeKey(stroke);
      if (usedStrokes.has(key)) {
        throw new AutomaticSigningKeywordError(
          `PDF has an ambiguous signature line for ${documentExecutionSlotLabel(
            slot.roleKey,
            slot.slotIndex
          )}.`
        );
      }
      usedStrokes.add(key);
    }
    const fallback = witnessBlockBounds(slot.roleKey, lines).start;
    const tabLeft = hangingTabLeft(strokes, lines, items, stroke);
    const date =
      stroke && executionRoleHasSignDate(slot.roleKey)
        ? dateGeometryForStroke(stroke, lines, items, strokes[slot.slotIndex], tabLeft)
        : undefined;
    return anchorFromStroke(slot, stroke, fallback, date);
  });

  return alignDateKeywordsInColumn([...representativeAnchors, ...witnessAnchors]);
}

export function resolveAutomaticKeywordOwners(
  documentKey: string,
  repeats?: DocumentExecutionRepeatCounts | null,
  owners?: readonly AutomaticSignerKeywordOwner[] | null
): AutomaticSignerKeywordOwner[] {
  const slots = documentExecutionSlotsForPackageKey(documentKey, repeats);
  if (slots.length === 0) return [];
  const resolved = owners?.length ? [...owners] : defaultAutomaticKeywordOwners(documentKey, repeats);
  const collision = automaticSignerKeywordCollisionIssue(resolved);
  if (collision) throw new AutomaticSigningKeywordError(collision);
  const limit = automaticContractKeywordLimitIssue(resolved);
  if (limit) throw new AutomaticSigningKeywordError(limit);
  for (const slot of slots) {
    if (ownerForSlot(resolved, slot.roleKey, slot.slotIndex)) continue;
    throw new AutomaticSigningKeywordError(
      `PDF is missing an automatic signer for ${documentExecutionSlotLabel(slot.roleKey, slot.slotIndex)}.`
    );
  }
  return resolved;
}

export function automaticSigningKeywordIssues(
  items: readonly JsgPdfTextItem[],
  owners: readonly AutomaticSignerKeywordOwner[]
): string[] {
  const joined = items.map((item) => item.text).join("\n");
  const issues: string[] = [];
  for (const owner of owners) {
    const signExpected = owner.placements.length;
    const signFound = countKeywordOccurrences(joined, owner.signKeyword);
    if (signFound < signExpected) {
      issues.push(`Missing automatic-signing keyword ${owner.signKeyword}.`);
    } else if (signFound > signExpected) {
      issues.push(`Duplicate automatic-signing keyword ${owner.signKeyword}.`);
    }
    const dateExpected = owner.placements.filter((placement) =>
      executionRoleHasSignDate(placement.roleKey)
    ).length;
    if (dateExpected > 0 && !owner.dateKeyword) {
      issues.push(`Missing automatic date keyword for ${owner.signKeyword}.`);
      continue;
    }
    if (!owner.dateKeyword) continue;
    const dateFound = countKeywordOccurrences(joined, owner.dateKeyword);
    if (dateFound < dateExpected) {
      issues.push(`Missing automatic-signing keyword ${owner.dateKeyword}.`);
    } else if (dateFound > dateExpected) {
      issues.push(`Duplicate automatic-signing keyword ${owner.dateKeyword}.`);
    }
  }
  return issues;
}

function dateKeywordDrawLeft(
  targetX: number,
  keyword: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  pageWidth: number
): number {
  const textWidth = font.widthOfTextAtSize(keyword, KEYWORD_FONT_SIZE);
  const stampWidth = font.widthOfTextAtSize(AUTO_DATE_STAMP_SAMPLE, AUTO_DATE_STAMP_FONT_SIZE);
  const drawX = targetX - textWidth / 2 + stampWidth / 2 + AUTO_DATE_STAMP_RIGHT_NUDGE;
  const maxX = Math.max(8, pageWidth - textWidth - 2);
  return Math.min(Math.max(drawX, 8), maxX);
}

function signKeywordDrawLeft(
  targetX: number,
  keyword: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  pageWidth: number
): number {
  const textWidth = font.widthOfTextAtSize(keyword, KEYWORD_FONT_SIZE);
  const drawX = targetX - AUTO_SIGN_STAMP_LEFT_NUDGE;
  const maxX = Math.max(8, pageWidth - textWidth - 2);
  return Math.min(Math.max(drawX, 8), maxX);
}

function drawHiddenKeyword(
  page: ReturnType<PDFDocument["getPage"]>,
  keyword: string,
  x: number,
  yTop: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>
): void {
  const textWidth = font.widthOfTextAtSize(keyword, KEYWORD_FONT_SIZE);
  const maxX = Math.max(8, page.getWidth() - textWidth - 2);
  page.drawText(keyword, {
    x: Math.min(Math.max(x, 8), maxX),
    y: Math.max(8, page.getHeight() - yTop - 2),
    size: KEYWORD_FONT_SIZE,
    font,
    color: rgb(1, 1, 1),
  });
}

export async function ensureAutomaticSigningKeywords(
  pdfBuffer: Buffer,
  documentKey: string,
  repeats?: DocumentExecutionRepeatCounts | null,
  owners?: readonly AutomaticSignerKeywordOwner[] | null
): Promise<Buffer> {
  const slots = documentExecutionSlotsForPackageKey(documentKey, repeats);
  if (slots.length === 0) return pdfBuffer;
  const resolvedOwners = resolveAutomaticKeywordOwners(documentKey, repeats, owners);

  const items = await extractPdfTextItems(pdfBuffer);
  const existingIssues = automaticSigningKeywordIssues(items, resolvedOwners);
  const duplicates = existingIssues.filter((issue) => issue.startsWith("Duplicate"));
  if (duplicates.length > 0) {
    throw new AutomaticSigningKeywordError(duplicates[0] ?? "Duplicate automatic-signing keyword.");
  }
  if (existingIssues.length === 0) return pdfBuffer;

  const anchors = findAutomaticKeywordAnchors(items, slots);
  const pdf = await PDFDocument.load(pdfBuffer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pageCount = pdf.getPageCount();
  for (const anchor of anchors) {
    const owner = ownerForSlot(resolvedOwners, anchor.roleKey, anchor.slotIndex);
    if (!owner) {
      throw new AutomaticSigningKeywordError(
        `PDF is missing an automatic signer for ${documentExecutionSlotLabel(
          anchor.roleKey,
          anchor.slotIndex
        )}.`
      );
    }
    const pageNumber = Math.min(Math.max(anchor.pageindex, 1), Math.max(pageCount, 1));
    const page = pdf.getPage(pageNumber - 1);
    if (!keywordPresentNear(items, owner.signKeyword, anchor.pageindex, anchor.x, anchor.yTop)) {
      drawHiddenKeyword(
        page,
        owner.signKeyword,
        signKeywordDrawLeft(
          anchor.x,
          owner.signKeyword,
          font,
          anchor.pageWidth ?? LAYOUT_DETECTED_SIGN_FIELD.defaultPageWidth
        ),
        anchor.yTop,
        font
      );
    }
    if (!owner.dateKeyword || !executionRoleHasSignDate(anchor.roleKey)) continue;
    if (!anchor.date) {
      throw new AutomaticSigningKeywordError(
        `PDF is missing a Date line for ${documentExecutionSlotLabel(anchor.roleKey, anchor.slotIndex)}.`
      );
    }
    if (
      !keywordPresentNear(
        items,
        owner.dateKeyword,
        anchor.date.pageindex,
        anchor.date.x,
        anchor.date.yTop
      )
    ) {
      const datePageNumber = Math.min(Math.max(anchor.date.pageindex, 1), Math.max(pageCount, 1));
      drawHiddenKeyword(
        pdf.getPage(datePageNumber - 1),
        owner.dateKeyword,
        dateKeywordDrawLeft(
          anchor.date.x,
          owner.dateKeyword,
          font,
          anchor.date.pageWidth ?? LAYOUT_DETECTED_SIGN_FIELD.defaultPageWidth
        ),
        anchor.date.yTop,
        font
      );
    }
  }

  const next = Buffer.from(await pdf.save());
  const nextItems = await extractPdfTextItems(next);
  const nextIssues = automaticSigningKeywordIssues(nextItems, resolvedOwners);
  if (nextIssues.length > 0) {
    throw new AutomaticSigningKeywordError(
      nextIssues[0] ?? "Automatic-signing keywords were not written to the PDF."
    );
  }
  return next;
}
