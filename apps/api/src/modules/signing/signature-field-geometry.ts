/**
 * Shared SigningCloud signature-field geometry.
 * Layout-detected CA boxes (FA / JSG / DOA) sit on execution-line strokes.
 * Stacked defaults are the provider fallback and PDFKit offer-letter size.
 */

export type SigningCloudSignField = {
  fieldtype: "sign";
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
  topOffset: 6,
  minTop: 24,
  minLeft: 20,
  defaultPageWidth: 595,
  defaultPageHeight: 842,
} as const;

export type SignatureLineGeometry = {
  pageindex: number;
  x: number;
  yTop: number;
  width: number;
  pageWidth?: number;
  pageHeight?: number;
};

export type NamedSignatureSlot = SigningCloudSignField & {
  name: string;
};

export function normalizeSignerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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
      throw createError("Signature field pageindex must be a 1-based page number.");
    }
    if (field.width <= 0 || field.height <= 0 || field.left < 0 || field.top < 0) {
      throw createError("Signature field is outside the page bounds.");
    }
  }
  for (let i = 0; i < fields.length; i += 1) {
    for (let j = i + 1; j < fields.length; j += 1) {
      const a = fields[i];
      const b = fields[j];
      if (a && b && signatureFieldsOverlap(a, b)) {
        throw createError("Signature fields overlap on the same page.");
      }
    }
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
