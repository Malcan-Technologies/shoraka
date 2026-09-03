import {
  extractPdfTextItems,
  linesFromJsgPdfItems,
  type JsgPdfLine,
  type JsgPdfTextItem,
} from "../joint-several-guarantee/jsg-signing-placement";
import type { SigningCloudSignField } from "../joint-several-guarantee/jsg-signing-signsets";

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
};

const SAME_COLUMN_X = 50;
const LINE_SEARCH_BELOW = 55;

function compactLineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeFaSignerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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

function nameFromIssuerLabel(label: JsgPdfLine, lines: JsgPdfLine[]): string {
  const sameLine = compactLineText(label.text).match(/^Name\s*:\s*(.*)$/i)?.[1]?.trim();
  if (sameLine) return sameLine;
  const named = lines
    .filter(
      (candidate) =>
        candidate.pageindex === label.pageindex &&
        sameColumn(candidate, label) &&
        candidate.yTop > label.yTop &&
        candidate.yTop - label.yTop <= LINE_SEARCH_BELOW * 1.4
    )
    .sort((a, b) => a.yTop - b.yTop)
    .map((candidate) => compactLineText(candidate.text))
    .find((text) => text.length > 0 && !/^designation/i.test(text) && !/^date/i.test(text));
  return named ?? "";
}

function fieldFromSignatureLine(line: JsgPdfLine): Pick<
  FaSignatureSlot,
  "pageindex" | "top" | "left" | "height" | "width"
> {
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

function isIssuerNameLabel(text: string): boolean {
  const value = compactLineText(text);
  if (/^name of witness/i.test(value)) return false;
  return /^name\s*:/i.test(value);
}

/** CA slots on ISSUER execution underscored lines only — never Investor, Agent, or witness. */
export function collectFaIssuerSignatureSlots(items: JsgPdfTextItem[]): FaSignatureSlot[] {
  const lines = linesFromJsgPdfItems(items);
  const executionLines = issuerExecutionLines(lines);
  if (executionLines.length === 0) {
    throw new FaSigningLayoutError("Facility Agreement PDF is missing the ISSUER execution block.");
  }
  const slots: FaSignatureSlot[] = [];

  for (const line of executionLines) {
    if (!isUnderscoreLine(line.text)) continue;
    const below = lineBelow(line, executionLines);
    if (!below || !isIssuerNameLabel(below.text)) continue;
    slots.push({
      name: nameFromIssuerLabel(below, executionLines),
      ...fieldFromSignatureLine(line),
    });
  }

  return slots.sort((a, b) => a.pageindex - b.pageindex || a.top - b.top || a.left - b.left);
}

export function matchFaSignersToSlots(
  signerNames: string[],
  slots: FaSignatureSlot[]
): SigningCloudSignField[][] {
  if (slots.length === 0) {
    throw new FaSigningLayoutError("Facility Agreement PDF is missing issuer signature lines.");
  }

  const unused = slots.map((slot) => ({ ...slot, used: false }));
  const signsets: SigningCloudSignField[][] = [];

  for (const signerName of signerNames) {
    const needle = normalizeFaSignerName(signerName);
    if (!needle) {
      throw new FaSigningLayoutError("Facility Agreement signer is missing a name.");
    }
    const named = unused.find(
      (entry) => !entry.used && normalizeFaSignerName(entry.name) === needle
    );
    const unnamed = unused.find((entry) => !entry.used && !normalizeFaSignerName(entry.name));
    const slot = named ?? unnamed;
    if (!slot) {
      const available = slots.map((entry) => entry.name).filter(Boolean).join(", ") || "(none)";
      throw new FaSigningLayoutError(
        `Could not place Facility Agreement signature for "${signerName}" on an issuer line. Found: ${available}.`
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

  if (unused.some((entry) => !entry.used)) {
    throw new FaSigningLayoutError(
      `Facility Agreement issuer signature lines (${slots.length}) do not match signer count (${signerNames.length}).`
    );
  }

  return signsets;
}

export async function buildFaSigningCloudSignsetsFromPdf(
  pdfBuffer: Buffer,
  signerNames: string[]
): Promise<SigningCloudSignField[][]> {
  if (signerNames.length === 0) return [];
  try {
    const items = await extractPdfTextItems(pdfBuffer);
    const slots = collectFaIssuerSignatureSlots(items);
    return matchFaSignersToSlots(signerNames, slots);
  } catch (err) {
    if (err instanceof FaSigningLayoutError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new FaSigningLayoutError(
      `Could not read Facility Agreement signature lines from the PDF (${detail}).`
    );
  }
}
