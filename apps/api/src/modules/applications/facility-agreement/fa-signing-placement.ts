import {
  extractPdfTextItems,
  linesFromJsgPdfItems,
  type JsgPdfLine,
  type JsgPdfTextItem,
} from "../joint-several-guarantee/jsg-signing-placement";
import type { SigningCloudSignField } from "../joint-several-guarantee/jsg-signing-signsets";
import {
  dateFieldFromLine,
  findSignerDateLabel,
  findSignerDesignationLabel,
  fitDateFieldBetweenSignatures,
  fitSignFieldAbovePrintedLine,
  isCompanyStampLabel,
  isSignerDateLabel,
  isSignerDesignationLabel,
  isSignerNameLabel,
  isSignerNricLabel,
  joinWrappedSignerName,
  LAYOUT_DETECTED_DATE_FIELD,
  matchSignersToNamedSlots,
  sealFieldFromLabel,
  signatureFieldFromLine,
  textFieldFromLine,
  attachPrimarySealField,
  asLayoutDetectedSigners,
  namesFromLayoutDetectedSigners,
  type LayoutDetectedSigner,
} from "../../signing/signature-field-geometry";

export class FaSigningLayoutError extends Error {
  readonly code = "FA_SIGNING_LAYOUT";

  constructor(message: string) {
    super(message);
    this.name = "FaSigningLayoutError";
  }
}

export type FaSignatureSlot = {
  name: string;
  pageindex: number;
  top: number;
  left: number;
  height: number;
  width: number;
  extraFields?: SigningCloudSignField[];
};

const SAME_COLUMN_X = 50;
const LINE_SEARCH_BELOW = 55;
const DATE_SEARCH_BELOW = LAYOUT_DETECTED_DATE_FIELD.maxBelow;

function compactLineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isUnderscoreLine(text: string): boolean {
  return /^_{8,}$/.test(text.replace(/\s+/g, ""));
}

function sameColumn(a: { x: number }, b: { x: number }): boolean {
  return Math.abs(a.x - b.x) < SAME_COLUMN_X;
}

function isAfter(line: JsgPdfLine, origin: JsgPdfLine): boolean {
  return (
    line.pageindex > origin.pageindex ||
    (line.pageindex === origin.pageindex && line.yTop > origin.yTop)
  );
}

function isAtOrAfter(line: JsgPdfLine, origin: JsgPdfLine): boolean {
  return (
    line.pageindex > origin.pageindex ||
    (line.pageindex === origin.pageindex && line.yTop >= origin.yTop)
  );
}

/** ISSUER execution through the line above SCHEDULE 1, including when they share a page. */
function issuerExecutionLines(lines: JsgPdfLine[]): JsgPdfLine[] {
  const agent = lines.find((line) => compactLineText(line.text) === "AGENT");
  const issuer = lines.find(
    (line) =>
      compactLineText(line.text) === "ISSUER" && (agent == null || isAfter(line, agent))
  );
  if (!issuer) return [];
  const schedule = lines.find(
    (line) => compactLineText(line.text) === "SCHEDULE 1" && isAfter(line, issuer)
  );
  return lines.filter((line) => {
    if (!isAtOrAfter(line, issuer)) return false;
    return schedule == null || !isAtOrAfter(line, schedule);
  });
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

function isIssuerNameContinuationStop(text: string): boolean {
  const value = compactLineText(text);
  if (!value) return true;
  if (isUnderscoreLine(text)) return true;
  if (/^name of witness/i.test(value)) return true;
  if (isSignerNameLabel(text)) return true;
  if (isSignerDesignationLabel(text) || isSignerDateLabel(text) || isSignerNricLabel(text)) {
    return true;
  }
  if (isCompanyStampLabel(text) || /company stamp/i.test(value)) return true;
  const lower = value.toLowerCase();
  return lower === "schedule 1" || lower === "issuer";
}

function nameFromIssuerLabel(label: JsgPdfLine, lines: JsgPdfLine[]): string {
  return joinWrappedSignerName(label, lines, {
    maxBelow: LINE_SEARCH_BELOW * 1.4,
    isStop: isIssuerNameContinuationStop,
  });
}

function fieldFromSignatureLine(line: JsgPdfLine): Pick<
  FaSignatureSlot,
  "pageindex" | "top" | "left" | "height" | "width"
> {
  const field = signatureFieldFromLine(line);
  return {
    pageindex: field.pageindex,
    top: field.top,
    left: field.left,
    height: field.height,
    width: field.width,
  };
}

function isIssuerNameLabel(text: string): boolean {
  const value = compactLineText(text);
  if (/^name of witness/i.test(value)) return false;
  return /^name\s*:/i.test(value);
}

export type FaPlacementOptions = {
  includeTextField?: boolean;
  includeSeal?: boolean;
};

/** CA slots on ISSUER execution underscored lines only — never Investor, Agent, or witness. */
export function collectFaIssuerSignatureSlots(
  items: JsgPdfTextItem[],
  options: Pick<FaPlacementOptions, "includeTextField"> = {}
): FaSignatureSlot[] {
  const lines = linesFromJsgPdfItems(items);
  const executionLines = issuerExecutionLines(lines);
  if (executionLines.length === 0) {
    throw new FaSigningLayoutError("Facility Agreement PDF is missing the ISSUER execution block.");
  }
  const located: Array<
    FaSignatureSlot & { strokeX: number; strokeYTop: number; printedYTop: number }
  > = [];

  for (const line of executionLines) {
    if (!isUnderscoreLine(line.text)) continue;
    const below = lineBelow(line, executionLines);
    if (!below || !isIssuerNameLabel(below.text)) continue;
    located.push({
      name: nameFromIssuerLabel(below, executionLines),
      ...fieldFromSignatureLine(line),
      strokeX: line.x,
      strokeYTop: line.yTop,
      printedYTop: below.yTop,
    });
  }

  located.sort((a, b) => a.pageindex - b.pageindex || a.strokeYTop - b.strokeYTop || a.left - b.left);

  const slots: FaSignatureSlot[] = [];
  let previousBottom: number | undefined;
  for (let index = 0; index < located.length; index += 1) {
    const current = located[index];
    if (!current) continue;
    const next = located[index + 1];
    const dateLine = findSignerDateLabel(
      { pageindex: current.pageindex, x: current.strokeX, yTop: current.strokeYTop },
      executionLines,
      {
        sameColumnDelta: SAME_COLUMN_X,
        maxBelow: DATE_SEARCH_BELOW,
        beforeYTop:
          next && next.pageindex === current.pageindex ? next.strokeYTop : undefined,
      }
    );
    if (!dateLine) {
      throw new FaSigningLayoutError(
        `Facility Agreement PDF is missing a Date line for "${current.name || "an issuer signatory"}".`
      );
    }
    const samePagePrevious =
      previousBottom != null && slots[slots.length - 1]?.pageindex === current.pageindex
        ? previousBottom
        : undefined;
    const signField = fitSignFieldAbovePrintedLine(
      {
        fieldtype: "sign",
        pageindex: current.pageindex,
        top: current.top,
        left: current.left,
        height: current.height,
        width: current.width,
      },
      current.printedYTop,
      samePagePrevious
    );
    const extraFields = [
      fitDateFieldBetweenSignatures(dateFieldFromLine(dateLine), signField, undefined),
    ];
    const designationLine = findSignerDesignationLabel(
      { pageindex: current.pageindex, x: current.strokeX, yTop: current.strokeYTop },
      executionLines,
      {
        sameColumnDelta: SAME_COLUMN_X,
        maxBelow: DATE_SEARCH_BELOW,
        beforeYTop: dateLine.yTop,
      }
    );
    if (options.includeTextField) {
      if (!designationLine) {
        throw new FaSigningLayoutError(
          `Facility Agreement PDF is missing a Designation line for "${current.name || "an issuer signatory"}".`
        );
      }
      extraFields.push(textFieldFromLine(designationLine));
    }
    slots.push({
      name: current.name,
      pageindex: signField.pageindex,
      top: signField.top,
      left: signField.left,
      height: signField.height,
      width: signField.width,
      extraFields,
    });
    const dateField = extraFields[0];
    previousBottom = dateField ? dateField.top + dateField.height : signField.top + signField.height;
  }

  return slots;
}

export function matchFaSignersToSlots(
  signerNames: string[],
  slots: FaSignatureSlot[]
): SigningCloudSignField[][] {
  if (slots.length === 0) {
    throw new FaSigningLayoutError("Facility Agreement PDF is missing issuer signature lines.");
  }
  return matchSignersToNamedSlots(
    signerNames,
    slots.map((slot) => ({ ...slot, fieldtype: "sign" as const })),
    {
      documentLabel: "Facility Agreement",
      allowUnnamedFallback: true,
      requireAllSlotsUsed: true,
      createError: (message) => new FaSigningLayoutError(message),
    }
  );
}

export function findFaIssuerCompanyStampLine(
  items: readonly JsgPdfTextItem[]
): JsgPdfLine | undefined {
  const labels = issuerExecutionLines(linesFromJsgPdfItems([...items])).filter((line) =>
    isCompanyStampLabel(line.text)
  );
  return labels[labels.length - 1];
}

function faSealOriginsForAppliers(
  items: readonly JsgPdfTextItem[],
  signers: readonly LayoutDetectedSigner[]
): Array<{ left: number; top: number; pageindex?: number }> {
  if (!signers.some((signer) => signer.appliesCompanySeal)) return [];
  const stamp = findFaIssuerCompanyStampLine(items);
  if (!stamp) return [];
  const field = sealFieldFromLabel(stamp);
  return [{ left: field.left, top: field.top, pageindex: field.pageindex }];
}

export async function buildFaSigningCloudSignsetsFromPdf(
  pdfBuffer: Buffer,
  signers: string[] | LayoutDetectedSigner[],
  options: FaPlacementOptions = {}
): Promise<SigningCloudSignField[][]> {
  const signerNames = namesFromLayoutDetectedSigners(signers);
  if (signerNames.length === 0) return [];
  try {
    const items = await extractPdfTextItems(pdfBuffer);
    const slots = collectFaIssuerSignatureSlots(items, {
      includeTextField: options.includeTextField,
    });
    const signsets = matchFaSignersToSlots(signerNames, slots);
    if (!options.includeSeal) return signsets;
    const page = items[0]
      ? { pageWidth: items[0].pageWidth, pageHeight: items[0].pageHeight }
      : {};
    const preferredOrigins = faSealOriginsForAppliers(items, asLayoutDetectedSigners(signers));
    return attachPrimarySealField(
      signsets,
      asLayoutDetectedSigners(signers),
      page,
      (message) => new FaSigningLayoutError(message),
      preferredOrigins
    );
  } catch (err) {
    if (err instanceof FaSigningLayoutError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new FaSigningLayoutError(
      `Could not read Facility Agreement signature lines from the PDF (${detail}).`
    );
  }
}
