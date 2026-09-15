/**
 * Shared SigningCloud signature-field geometry.
 * Layout-detected CA boxes (FA / JSG / DOA) sit on execution-line strokes.
 * Stacked defaults are the provider fallback and PDFKit offer-letter size.
 */

export type SigningCloudFieldType = "sign" | "signdate" | "textfield" | "seal";

export type SigningCloudSignField = {
  fieldtype: SigningCloudFieldType;
  top: number;
  left: number;
  height: number;
  width: number;
  pageindex: number;
};

/** Same rectangle as SigningCloud stacked defaults / PDFKit offer-letter blocks. */
export const SIGNING_CLOUD_STACKED_SIGN_FIELD = {
  fieldtype: "sign" as const,
  top: 549,
  left: 140,
  height: 30,
  width: 100,
};

/** Layout-detected boxes: sit on the stroke with room above the printed line. */
export const LAYOUT_DETECTED_SIGN_FIELD = {
  height: 36,
  minWidth: 120,
  maxWidth: 240,
  /** `top = yTop - height + topOffset` so the box sits on the stroke. */
  topOffset: 2,
  minHeight: 18,
  minTop: 24,
  minLeft: 20,
  defaultPageWidth: 595,
  defaultPageHeight: 842,
} as const;

/**
 * SigningCloud displays `signdate` at width = 5 × height.
 * Sit the box on the printed Date line, to the right of the label.
 * Offset 4 (not 2): SigningCloud stamps the date near the top of the field, so a
 * smaller offset left the digits sitting above the Date label baseline.
 */
export const LAYOUT_DETECTED_DATE_FIELD = {
  height: 14,
  widthMultiplier: 5,
  leftGap: 4,
  topOffset: 4,
  minTop: 24,
  minLeft: 20,
} as const;

/** Keep CA boxes off the next printed signer-detail line (Name / Designation / NRIC). */
export const LAYOUT_DETECTED_PRINTED_LINE_GAP = 4;

/** Manual Designation entry. Sit on the printed label line, to the right of the colon. */
export const LAYOUT_DETECTED_TEXT_FIELD = {
  height: 16,
  minWidth: 100,
  maxWidth: 220,
  leftGap: 4,
  topOffset: 2,
  minTop: 24,
  minLeft: 20,
} as const;

/** Organisation seal for the primary seal applier. Pixel image is ≤300×300; the PDF box is smaller. */
export const LAYOUT_DETECTED_SEAL_FIELD = {
  height: 44,
  width: 44,
  gap: 8,
  minTop: 24,
  minLeft: 20,
} as const;

export type SignatureLineGeometry = {
  pageindex: number;
  x: number;
  yTop: number;
  width: number;
  pageWidth?: number;
  pageHeight?: number;
  text?: string;
};

export type NamedSignatureSlot = SigningCloudSignField & {
  name: string;
  extraFields?: readonly SigningCloudSignField[];
};

export function normalizeSignerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Invisible CashSouk `/signature/auto` keywords. Stop at `_SIGN`/`_DATE` so `_DATEDate` does not swallow Date. */
const AUTOMATIC_SIGNING_KEYWORD =
  /CASHSOUK_[A-Z0-9_]*_(?:SIGN|DATE)|CASHSOUK_[A-Z0-9_]+(?![A-Za-z0-9_])/g;

export function signatureStrokeGlyphs(text: string): string {
  return text
    .replace(AUTOMATIC_SIGNING_KEYWORD, "")
    .replace(/\u2026/g, "...")
    .replace(/[\u2024\u2027\u22EF\u00B7\u2022\u30FB]/g, ".")
    .replace(/[\u2012\u2013\u2014\u2015\u2500\u2501]/g, "_")
    .replace(/\s+/g, "");
}

export function isAutomaticSigningKeywordLine(text: string): boolean {
  return /^CASHSOUK_[A-Z0-9_]+$/.test(text.replace(/\s+/g, " ").trim());
}

export function isDottedSignatureStroke(text: string): boolean {
  return /^\.{8,}$/.test(signatureStrokeGlyphs(text));
}

export function isUnderscoreSignatureStroke(text: string): boolean {
  return /^_{8,}$/.test(signatureStrokeGlyphs(text));
}

export function isSignatureStrokeLine(text: string): boolean {
  return isDottedSignatureStroke(text) || isUnderscoreSignatureStroke(text);
}

/** One run of dots or underscores, including a single glyph from PDF text extraction. */
export function isSignatureStrokeGlyphRun(text: string): boolean {
  const glyphs = signatureStrokeGlyphs(text);
  return glyphs.length > 0 && (/^\.+$/.test(glyphs) || /^_+$/.test(glyphs));
}

export function isSignerDateLabel(text: string): boolean {
  const value = text
    .replace(AUTOMATIC_SIGNING_KEYWORD, "")
    .replace(/\s+/g, " ")
    .trim();
  return /^date(\s*:.*)?$/i.test(value);
}

export function isSignerDesignationLabel(text: string): boolean {
  return /^designation\s*:/i.test(text.replace(/\s+/g, " ").trim());
}

export function isSignerNricLabel(text: string): boolean {
  return /^nric(\s*(\/|\s)*passport)?(\s*no\.?)?\s*:/i.test(text.replace(/\s+/g, " ").trim());
}

export function isSignerNameLabel(text: string): boolean {
  const value = text.replace(/\s+/g, " ").trim();
  if (/^name of witness/i.test(value)) return false;
  return /^((full\s+)?name)(\s*:.*)?$/i.test(value);
}

export function isCompanyStampLabel(text: string): boolean {
  return /^company\s+stamp\s*:?/i.test(text.replace(/\s+/g, " ").trim());
}

export type DateLabelAnchor = {
  pageindex: number;
  x: number;
  yTop: number;
  text: string;
  height?: number;
};

export function findSignerDateLabel<T extends DateLabelAnchor>(
  origin: { pageindex: number; x: number; yTop: number },
  lines: readonly T[],
  options: {
    sameColumnDelta: number;
    maxBelow: number;
    beforeYTop?: number;
  }
): T | undefined {
  return findLabeledLine(origin, lines, isSignerDateLabel, options);
}

export function findSignerDesignationLabel<T extends DateLabelAnchor>(
  origin: { pageindex: number; x: number; yTop: number },
  lines: readonly T[],
  options: {
    sameColumnDelta: number;
    maxBelow: number;
    beforeYTop?: number;
  }
): T | undefined {
  return findLabeledLine(origin, lines, isSignerDesignationLabel, options);
}

export function findSignerNricLabel<T extends DateLabelAnchor>(
  origin: { pageindex: number; x: number; yTop: number },
  lines: readonly T[],
  options: {
    sameColumnDelta: number;
    maxBelow: number;
    beforeYTop?: number;
  }
): T | undefined {
  return findLabeledLine(origin, lines, isSignerNricLabel, options);
}

export function findSignerNameLabel<T extends DateLabelAnchor>(
  origin: { pageindex: number; x: number; yTop: number },
  lines: readonly T[],
  options: {
    sameColumnDelta: number;
    maxBelow: number;
    beforeYTop?: number;
  }
): T | undefined {
  return findLabeledLine(origin, lines, isSignerNameLabel, options);
}

export function printedLineBottom(line: { yTop: number; height?: number }): number {
  return line.yTop + Math.max(line.height ?? 0, 8);
}

/** Lowest Name / Designation / NRIC line above the Date label, for date-box clearance. */
export function signerDetailLineBottomBeforeDate<T extends DateLabelAnchor>(
  origin: { pageindex: number; x: number; yTop: number },
  lines: readonly T[],
  options: {
    sameColumnDelta: number;
    maxBelow: number;
    beforeYTop: number;
  }
): number | undefined {
  const found = [
    findSignerDesignationLabel(origin, lines, options),
    findSignerNricLabel(origin, lines, options),
    findSignerNameLabel(origin, lines, options),
  ].filter((line): line is T => line != null);
  if (found.length === 0) return undefined;
  const last = [...found].sort((a, b) => a.yTop - b.yTop)[found.length - 1];
  return last ? printedLineBottom(last) : undefined;
}

function findLabeledLine<T extends DateLabelAnchor>(
  origin: { pageindex: number; x: number; yTop: number },
  lines: readonly T[],
  isLabel: (text: string) => boolean,
  options: {
    sameColumnDelta: number;
    maxBelow: number;
    beforeYTop?: number;
  }
): T | undefined {
  return lines
    .filter((line) => {
      if (line.pageindex !== origin.pageindex) return false;
      if (Math.abs(line.x - origin.x) >= options.sameColumnDelta) return false;
      if (line.yTop <= origin.yTop) return false;
      if (line.yTop - origin.yTop > options.maxBelow) return false;
      if (options.beforeYTop != null && line.yTop >= options.beforeYTop) return false;
      return isLabel(line.text);
    })
    .sort((a, b) => a.yTop - b.yTop)[0];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function positivePageSize(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** SigningCloud rectangle for one detected signature stroke (top-origin, 1-based page). */
export function signatureFieldFromLine(line: SignatureLineGeometry): SigningCloudSignField {
  const height = LAYOUT_DETECTED_SIGN_FIELD.height;
  const width = Math.max(
    LAYOUT_DETECTED_SIGN_FIELD.minWidth,
    Math.min(
      LAYOUT_DETECTED_SIGN_FIELD.maxWidth,
      Math.round(line.width) || LAYOUT_DETECTED_SIGN_FIELD.minWidth
    )
  );
  const pageWidth = positivePageSize(line.pageWidth, LAYOUT_DETECTED_SIGN_FIELD.defaultPageWidth);
  const pageHeight = positivePageSize(line.pageHeight, LAYOUT_DETECTED_SIGN_FIELD.defaultPageHeight);
  const maxLeft = Math.max(LAYOUT_DETECTED_SIGN_FIELD.minLeft, Math.floor(pageWidth - width));
  const left = clamp(Math.round(line.x), LAYOUT_DETECTED_SIGN_FIELD.minLeft, maxLeft);
  const maxTop = Math.max(LAYOUT_DETECTED_SIGN_FIELD.minTop, Math.floor(pageHeight - height));
  const top = clamp(
    Math.round(line.yTop - height + LAYOUT_DETECTED_SIGN_FIELD.topOffset),
    LAYOUT_DETECTED_SIGN_FIELD.minTop,
    maxTop
  );
  return {
    fieldtype: "sign",
    pageindex: Math.max(1, Math.round(line.pageindex) || 1),
    top,
    left,
    height,
    width,
  };
}

/** SigningCloud `signdate` rectangle for one printed Date line (top-origin, 1-based page). */
export function dateFieldFromLine(line: SignatureLineGeometry): SigningCloudSignField {
  const height = LAYOUT_DETECTED_DATE_FIELD.height;
  const width = height * LAYOUT_DETECTED_DATE_FIELD.widthMultiplier;
  const pageWidth = positivePageSize(line.pageWidth, LAYOUT_DETECTED_SIGN_FIELD.defaultPageWidth);
  const pageHeight = positivePageSize(line.pageHeight, LAYOUT_DETECTED_SIGN_FIELD.defaultPageHeight);
  const labelLeft = labelValueLeft(line, /^date\s*:?/i, LAYOUT_DETECTED_DATE_FIELD.leftGap);
  const maxLeft = Math.max(LAYOUT_DETECTED_DATE_FIELD.minLeft, Math.floor(pageWidth - width));
  const left = clamp(labelLeft, LAYOUT_DETECTED_DATE_FIELD.minLeft, maxLeft);
  const maxTop = Math.max(LAYOUT_DETECTED_DATE_FIELD.minTop, Math.floor(pageHeight - height));
  const top = clamp(
    Math.round(line.yTop - height + LAYOUT_DETECTED_DATE_FIELD.topOffset),
    LAYOUT_DETECTED_DATE_FIELD.minTop,
    maxTop
  );
  return {
    fieldtype: "signdate",
    pageindex: Math.max(1, Math.round(line.pageindex) || 1),
    top,
    left,
    height,
    width,
  };
}

function labelValueLeft(
  line: SignatureLineGeometry,
  labelPattern: RegExp,
  leftGap: number
): number {
  const text = (line.text ?? "").replace(/\s+/g, " ").trim();
  const rest = text.replace(labelPattern, "").trim();
  return rest.length === 0
    ? Math.round(line.x + Math.max(line.width, 0) + leftGap)
    : Math.round(
        line.x + Math.max(1, text.length - rest.length) * (line.width / Math.max(text.length, 1))
      );
}

/** SigningCloud `textfield` rectangle for a printed Designation line. */
export function textFieldFromLine(line: SignatureLineGeometry): SigningCloudSignField {
  const height = LAYOUT_DETECTED_TEXT_FIELD.height;
  const pageWidth = positivePageSize(line.pageWidth, LAYOUT_DETECTED_SIGN_FIELD.defaultPageWidth);
  const pageHeight = positivePageSize(line.pageHeight, LAYOUT_DETECTED_SIGN_FIELD.defaultPageHeight);
  const preferredLeft = labelValueLeft(
    line,
    /^designation\s*:/i,
    LAYOUT_DETECTED_TEXT_FIELD.leftGap
  );
  const width = Math.max(
    LAYOUT_DETECTED_TEXT_FIELD.minWidth,
    Math.min(
      LAYOUT_DETECTED_TEXT_FIELD.maxWidth,
      Math.round(line.width) || LAYOUT_DETECTED_TEXT_FIELD.minWidth
    )
  );
  const maxLeft = Math.max(LAYOUT_DETECTED_TEXT_FIELD.minLeft, Math.floor(pageWidth - width));
  const left = clamp(preferredLeft, LAYOUT_DETECTED_TEXT_FIELD.minLeft, maxLeft);
  const maxTop = Math.max(LAYOUT_DETECTED_TEXT_FIELD.minTop, Math.floor(pageHeight - height));
  const top = clamp(
    Math.round(line.yTop - height + LAYOUT_DETECTED_TEXT_FIELD.topOffset),
    LAYOUT_DETECTED_TEXT_FIELD.minTop,
    maxTop
  );
  return {
    fieldtype: "textfield",
    pageindex: Math.max(1, Math.round(line.pageindex) || 1),
    top,
    left,
    height,
    width,
  };
}

/** Organisation seal on a printed Company Stamp label, to the right of the colon. */
export function sealFieldFromLabel(line: SignatureLineGeometry): SigningCloudSignField {
  const width = LAYOUT_DETECTED_SEAL_FIELD.width;
  const height = LAYOUT_DETECTED_SEAL_FIELD.height;
  const pageWidth = positivePageSize(line.pageWidth, LAYOUT_DETECTED_SIGN_FIELD.defaultPageWidth);
  const pageHeight = positivePageSize(line.pageHeight, LAYOUT_DETECTED_SIGN_FIELD.defaultPageHeight);
  const preferredLeft = labelValueLeft(
    line,
    /^company\s+stamp\s*:/i,
    LAYOUT_DETECTED_SEAL_FIELD.gap
  );
  const maxLeft = Math.max(LAYOUT_DETECTED_SEAL_FIELD.minLeft, Math.floor(pageWidth - width));
  const left = clamp(preferredLeft, LAYOUT_DETECTED_SEAL_FIELD.minLeft, maxLeft);
  const maxTop = Math.max(LAYOUT_DETECTED_SEAL_FIELD.minTop, Math.floor(pageHeight - height));
  const top = clamp(
    Math.round(line.yTop - height + LAYOUT_DETECTED_SIGN_FIELD.topOffset),
    LAYOUT_DETECTED_SEAL_FIELD.minTop,
    maxTop
  );
  return {
    fieldtype: "seal",
    pageindex: Math.max(1, Math.round(line.pageindex) || 1),
    top,
    left,
    height,
    width,
  };
}

/** Place a seal to the right of a signature, or below it when the right edge would clip. */
export function sealFieldBesideSignature(
  sign: SigningCloudSignField,
  page: { pageWidth?: number; pageHeight?: number } = {}
): SigningCloudSignField {
  const width = LAYOUT_DETECTED_SEAL_FIELD.width;
  const height = LAYOUT_DETECTED_SEAL_FIELD.height;
  const pageWidth = positivePageSize(page.pageWidth, LAYOUT_DETECTED_SIGN_FIELD.defaultPageWidth);
  const pageHeight = positivePageSize(page.pageHeight, LAYOUT_DETECTED_SIGN_FIELD.defaultPageHeight);
  const rightLeft = sign.left + sign.width + LAYOUT_DETECTED_SEAL_FIELD.gap;
  const maxLeft = Math.max(LAYOUT_DETECTED_SEAL_FIELD.minLeft, Math.floor(pageWidth - width));
  const fitsRight = rightLeft <= maxLeft;
  const left = clamp(
    fitsRight ? rightLeft : sign.left,
    LAYOUT_DETECTED_SEAL_FIELD.minLeft,
    maxLeft
  );
  const preferredTop = fitsRight
    ? sign.top
    : sign.top + sign.height + LAYOUT_DETECTED_SEAL_FIELD.gap;
  const maxTop = Math.max(LAYOUT_DETECTED_SEAL_FIELD.minTop, Math.floor(pageHeight - height));
  const top = clamp(preferredTop, LAYOUT_DETECTED_SEAL_FIELD.minTop, maxTop);
  return {
    fieldtype: "seal",
    pageindex: sign.pageindex,
    top,
    left,
    height,
    width,
  };
}

function sealClearsFields(
  seal: SigningCloudSignField,
  others: readonly SigningCloudSignField[]
): boolean {
  return others.every((field) => !signatureFieldsOverlap(field, seal));
}

function nudgeSealBelowOverlap(
  seal: SigningCloudSignField,
  others: readonly SigningCloudSignField[],
  maxTop: number
): SigningCloudSignField | undefined {
  let candidate = seal;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (sealClearsFields(candidate, others)) return candidate;
    const hits = others.filter((field) => signatureFieldsOverlap(field, candidate));
    const nextTop =
      Math.max(...hits.map((field) => field.top + field.height)) + LAYOUT_DETECTED_SEAL_FIELD.gap;
    if (nextTop > maxTop) return undefined;
    candidate = { ...candidate, top: nextTop };
  }
  return undefined;
}

/**
 * Place the organisation seal beside the applier without covering their CA boxes.
 * Top-aligning a 44px seal with a 36px signature hangs into Designation on stacked FA blocks.
 */
export function fitSealField(
  sign: SigningCloudSignField,
  applierFields: readonly SigningCloudSignField[],
  existing: readonly SigningCloudSignField[],
  page: { pageWidth?: number; pageHeight?: number } = {},
  preferredOrigins: ReadonlyArray<{ left: number; top: number; pageindex?: number }> = []
): SigningCloudSignField {
  const width = LAYOUT_DETECTED_SEAL_FIELD.width;
  const height = LAYOUT_DETECTED_SEAL_FIELD.height;
  const gap = LAYOUT_DETECTED_SEAL_FIELD.gap;
  const pageWidth = positivePageSize(page.pageWidth, LAYOUT_DETECTED_SIGN_FIELD.defaultPageWidth);
  const pageHeight = positivePageSize(page.pageHeight, LAYOUT_DETECTED_SIGN_FIELD.defaultPageHeight);
  const maxLeft = Math.max(LAYOUT_DETECTED_SEAL_FIELD.minLeft, Math.floor(pageWidth - width));
  const maxTop = Math.max(LAYOUT_DETECTED_SEAL_FIELD.minTop, Math.floor(pageHeight - height));
  const applierOnPage = applierFields.filter((field) => field.pageindex === sign.pageindex);
  const rightEdge = Math.max(
    sign.left + sign.width,
    ...applierOnPage.map((field) => field.left + field.width)
  );
  const bottomEdge = Math.max(
    sign.top + sign.height,
    ...applierOnPage.map((field) => field.top + field.height)
  );
  const origins = [
    ...preferredOrigins.map((origin) => ({
      left: origin.left,
      top: origin.top,
      pageindex: origin.pageindex ?? sign.pageindex,
    })),
    { left: rightEdge + gap, top: sign.top, pageindex: sign.pageindex },
    { left: sign.left + sign.width + gap, top: sign.top, pageindex: sign.pageindex },
    { left: sign.left, top: bottomEdge + gap, pageindex: sign.pageindex },
  ];
  for (const origin of origins) {
    const pageindex = origin.pageindex;
    const others = existing.filter((field) => field.pageindex === pageindex);
    const fitted = nudgeSealBelowOverlap(
      {
        fieldtype: "seal",
        pageindex,
        left: clamp(origin.left, LAYOUT_DETECTED_SEAL_FIELD.minLeft, maxLeft),
        top: clamp(origin.top, LAYOUT_DETECTED_SEAL_FIELD.minTop, maxTop),
        width,
        height,
      },
      others,
      maxTop
    );
    if (fitted) return fitted;
  }
  return sealFieldBesideSignature(sign, page);
}

/**
 * Keep the signature box on the stroke, below the previous block, and clear of the
 * first printed signer-detail line (Name / Signature of Guarantor).
 */
export function fitSignFieldAbovePrintedLine(
  sign: SigningCloudSignField,
  printedYTop?: number,
  previousBottom?: number
): SigningCloudSignField {
  const gap = LAYOUT_DETECTED_PRINTED_LINE_GAP;
  const minHeight = LAYOUT_DETECTED_SIGN_FIELD.minHeight;
  const minTopBound =
    previousBottom != null && Number.isFinite(previousBottom)
      ? previousBottom + gap
      : LAYOUT_DETECTED_SIGN_FIELD.minTop;
  const maxBottom =
    printedYTop != null && Number.isFinite(printedYTop)
      ? printedYTop - gap
      : Number.POSITIVE_INFINITY;

  let top = Math.max(sign.top, minTopBound);
  let height = sign.height;
  let bottom = top + height;
  if (bottom > maxBottom) {
    bottom = maxBottom;
    height = bottom - top;
    if (height < minHeight) {
      height = minHeight;
      top = maxBottom - height;
      bottom = top + height;
    }
  }
  if (top < LAYOUT_DETECTED_SIGN_FIELD.minTop) {
    top = LAYOUT_DETECTED_SIGN_FIELD.minTop;
    height = Math.max(minHeight, bottom - top);
  }
  return { ...sign, top: Math.round(top), height: Math.round(height) };
}

/**
 * Keep a date box on its Date line when there is room, below printed Designation/NRIC
 * (or the signature), and out of the next signature when that bound is known.
 */
export function fitDateFieldBetweenSignatures(
  date: SigningCloudSignField,
  previousSign: SigningCloudSignField,
  nextSign: SigningCloudSignField | undefined,
  afterBottom?: number
): SigningCloudSignField {
  if (date.pageindex !== previousSign.pageindex) return date;
  const gap = LAYOUT_DETECTED_PRINTED_LINE_GAP;
  const minTop = Math.max(
    previousSign.top + previousSign.height,
    afterBottom != null && Number.isFinite(afterBottom) ? afterBottom + gap : Number.NEGATIVE_INFINITY,
    LAYOUT_DETECTED_DATE_FIELD.minTop
  );
  const maxTop =
    nextSign && nextSign.pageindex === date.pageindex
      ? nextSign.top - date.height
      : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(minTop)) return date;
  if (Number.isFinite(maxTop) && maxTop < minTop) {
    const maxBottom = nextSign!.top;
    const height = Math.max(8, Math.floor(maxBottom - minTop));
    return {
      ...date,
      top: Math.round(minTop),
      height,
      width: height * LAYOUT_DETECTED_DATE_FIELD.widthMultiplier,
    };
  }
  const upper = Number.isFinite(maxTop) ? maxTop : Math.max(date.top, minTop);
  return { ...date, top: Math.round(clamp(date.top, minTop, upper)) };
}

export function signatureFieldsOverlap(a: SigningCloudSignField, b: SigningCloudSignField): boolean {
  if (a.pageindex !== b.pageindex) return false;
  const aRight = a.left + a.width;
  const bRight = b.left + b.width;
  const aBottom = a.top + a.height;
  const bBottom = b.top + b.height;
  return a.left < bRight && b.left < aRight && a.top < bBottom && b.top < aBottom;
}

export function assertSignatureFieldsValid(
  fields: readonly SigningCloudSignField[],
  createError: (message: string) => Error
): void {
  for (const field of fields) {
    if (field.pageindex < 1 || !Number.isFinite(field.pageindex)) {
      throw createError("Signing field pageindex must be a 1-based page number.");
    }
    if (field.width <= 0 || field.height <= 0 || field.left < 0 || field.top < 0) {
      throw createError("Signing field is outside the page bounds.");
    }
  }
  for (let i = 0; i < fields.length; i += 1) {
    for (let j = i + 1; j < fields.length; j += 1) {
      const a = fields[i];
      const b = fields[j];
      if (a && b && signatureFieldsOverlap(a, b)) {
        throw createError(
          `Signing fields overlap on the same page (${a.fieldtype} p${a.pageindex} @${Math.round(a.left)},${Math.round(a.top)} ${Math.round(a.width)}x${Math.round(a.height)} vs ${b.fieldtype} @${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}).`
        );
      }
    }
  }
  assertAtMostOneSealField(fields, createError);
}

export function assertAtMostOneSealField(
  fields: readonly SigningCloudSignField[],
  createError: (message: string) => Error
): void {
  const seals = fields.filter((field) => field.fieldtype === "seal");
  if (seals.length > 1) {
    throw createError("A document may have only one organisation seal field.");
  }
}

export function matchSignersToNamedSlots(
  signerNames: string[],
  slots: NamedSignatureSlot[],
  options: {
    documentLabel: string;
    allowUnnamedFallback: boolean;
    requireAllSlotsUsed: boolean;
    createError: (message: string) => Error;
  }
): SigningCloudSignField[][] {
  if (slots.length === 0) {
    throw options.createError(`${options.documentLabel} PDF is missing signature lines.`);
  }

  const unused = slots.map((slot) => ({ ...slot, used: false }));
  const signsets: SigningCloudSignField[][] = [];

  for (const signerName of signerNames) {
    const needle = normalizeSignerName(signerName);
    if (!needle) {
      throw options.createError(`${options.documentLabel} signer is missing a name.`);
    }
    const named = unused.find(
      (entry) => !entry.used && normalizeSignerName(entry.name) === needle
    );
    const unnamed = options.allowUnnamedFallback
      ? unused.find((entry) => !entry.used && !normalizeSignerName(entry.name))
      : undefined;
    const slot = named ?? unnamed;
    if (!slot) {
      const available = slots.map((entry) => entry.name).filter(Boolean).join(", ") || "(none)";
      throw options.createError(
        `Could not place ${options.documentLabel} signature for "${signerName}" on an execution line. Found: ${available}.`
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
      ...(slot.extraFields ?? []),
    ]);
  }

  if (options.requireAllSlotsUsed && unused.some((entry) => !entry.used)) {
    throw options.createError(
      `${options.documentLabel} signature lines (${slots.length}) do not match signer count (${signerNames.length}).`
    );
  }

  const fields = signsets.flat();
  assertSignatureFieldsValid(fields, options.createError);
  return signsets;
}

export type LayoutDetectedSigner = {
  name: string;
  appliesCompanySeal?: boolean;
};

export function namesFromLayoutDetectedSigners(
  signers: readonly string[] | readonly LayoutDetectedSigner[]
): string[] {
  return signers.map((signer) => (typeof signer === "string" ? signer : signer.name));
}

export function asLayoutDetectedSigners(
  signers: readonly string[] | readonly LayoutDetectedSigner[]
): LayoutDetectedSigner[] {
  return signers.map((signer) => (typeof signer === "string" ? { name: signer } : signer));
}

/** Append the single organisation seal to the primary applier's signset. */
export function attachPrimarySealField(
  signsets: SigningCloudSignField[][],
  signers: readonly LayoutDetectedSigner[],
  page: { pageWidth?: number; pageHeight?: number },
  createError: (message: string) => Error,
  preferredOrigins: ReadonlyArray<{ left: number; top: number; pageindex?: number }> = []
): SigningCloudSignField[][] {
  const applierIndexes = signers.flatMap((signer, index) =>
    signer.appliesCompanySeal ? [index] : []
  );
  if (applierIndexes.length !== 1) {
    throw createError("Select exactly one issuer representative to apply the company seal.");
  }
  const index = applierIndexes[0];
  const signset = index == null ? undefined : signsets[index];
  const sign = signset?.find((field) => field.fieldtype === "sign");
  if (index == null || !signset || !sign) {
    throw createError("Could not place the organisation seal on the primary seal applier.");
  }
  const next = signsets.map((fields, fieldIndex) =>
    fieldIndex === index
      ? [...fields, fitSealField(sign, fields, signsets.flat(), page, preferredOrigins)]
      : fields
  );
  assertSignatureFieldsValid(next.flat(), createError);
  return next;
}
