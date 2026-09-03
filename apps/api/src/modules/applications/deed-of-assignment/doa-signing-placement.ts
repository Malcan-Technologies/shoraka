import {
  extractPdfTextItems,
  linesFromJsgPdfItems,
  type JsgPdfLine,
  type JsgPdfTextItem,
} from "../joint-several-guarantee/jsg-signing-placement";
import type { SigningCloudSignField } from "../joint-several-guarantee/jsg-signing-signsets";

export class DoaSigningLayoutError extends Error {
  readonly code = "DOA_SIGNING_LAYOUT";

  constructor(message: string) {
    super(message);
    this.name = "DoaSigningLayoutError";
  }
}

export type DoaSignatureSlot = {
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

function normalizeDoaSignerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isDotsLine(text: string): boolean {
  return /^\.{8,}$/.test(text.replace(/\s+/g, ""));
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

function isAssignorExecutionHeading(text: string): boolean {
  const value = compactLineText(text).toLowerCase();
  if (value === "assignor") return false;
  if (value.includes("minimum of two")) return true;
  if (value.startsWith("assignor") && value.includes("authorised signatories")) return true;
  return /^assignor\s*[–-]/.test(value);
}

/** ASSIGNOR execution through the line above SCHEDULE 1, including when they share a page. */
function assignorExecutionLines(lines: JsgPdfLine[]): JsgPdfLine[] {
  const heading = lines.find((line) => isAssignorExecutionHeading(line.text));
  if (!heading) return [];
  const schedule = lines.find(
    (line) => compactLineText(line.text) === "SCHEDULE 1" && isAfter(line, heading)
  );
  return lines.filter((line) => {
    if (!isAtOrAfter(line, heading)) return false;
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

function nameFromAssignorLabel(label: JsgPdfLine, lines: JsgPdfLine[]): string {
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
    .find(
      (text) =>
        text.length > 0 &&
        !/^nric/i.test(text) &&
        !/^designation/i.test(text) &&
        !/^\[witness\]/i.test(text)
    );
  return named ?? "";
}

function fieldFromSignatureLine(line: JsgPdfLine): Pick<
  DoaSignatureSlot,
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

function isAssignorNameLabel(text: string): boolean {
  const value = compactLineText(text);
  if (/^\[witness\]/i.test(value)) return false;
  if (/^name of witness/i.test(value)) return false;
  return /^name\s*:/i.test(value);
}

/** CA slots on ASSIGNOR dotted lines only — never SSP, witness, stamp, or schedules. */
export function collectDoaAssignorSignatureSlots(items: JsgPdfTextItem[]): DoaSignatureSlot[] {
  const lines = linesFromJsgPdfItems(items);
  const executionLines = assignorExecutionLines(lines);
  if (executionLines.length === 0) {
    throw new DoaSigningLayoutError("Deed of Assignment PDF is missing the ASSIGNOR execution block.");
  }
  const slots: DoaSignatureSlot[] = [];

  for (const line of executionLines) {
    if (!isDotsLine(line.text)) continue;
    const below = lineBelow(line, executionLines);
    if (!below) continue;
    if (/^\[witness\]/i.test(compactLineText(below.text))) continue;
    if (!isAssignorNameLabel(below.text)) continue;
    const name = nameFromAssignorLabel(below, executionLines);
    if (!name) continue;
    slots.push({
      name,
      ...fieldFromSignatureLine(line),
    });
  }

  return slots.sort((a, b) => a.pageindex - b.pageindex || a.top - b.top || a.left - b.left);
}

export function matchDoaSignersToSlots(
  signerNames: string[],
  slots: DoaSignatureSlot[]
): SigningCloudSignField[][] {
  if (slots.length === 0) {
    throw new DoaSigningLayoutError("Deed of Assignment PDF is missing assignor signature lines.");
  }

  const unused = slots.map((slot) => ({ ...slot, used: false }));
  const signsets: SigningCloudSignField[][] = [];

  for (const signerName of signerNames) {
    const needle = normalizeDoaSignerName(signerName);
    if (!needle) {
      throw new DoaSigningLayoutError("Deed of Assignment signer is missing a name.");
    }
    const named = unused.find(
      (entry) => !entry.used && normalizeDoaSignerName(entry.name) === needle
    );
    const unnamed = unused.find((entry) => !entry.used && !normalizeDoaSignerName(entry.name));
    const slot = named ?? unnamed;
    if (!slot) {
      const available = slots.map((entry) => entry.name).filter(Boolean).join(", ") || "(none)";
      throw new DoaSigningLayoutError(
        `Could not place Deed of Assignment signature for "${signerName}" on an assignor line. Found: ${available}.`
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
    throw new DoaSigningLayoutError(
      `Deed of Assignment assignor signature lines (${slots.length}) do not match signer count (${signerNames.length}).`
    );
  }

  return signsets;
}

export async function buildDoaSigningCloudSignsetsFromPdf(
  pdfBuffer: Buffer,
  signerNames: string[]
): Promise<SigningCloudSignField[][]> {
  if (signerNames.length === 0) return [];
  try {
    const items = await extractPdfTextItems(pdfBuffer);
    const slots = collectDoaAssignorSignatureSlots(items);
    return matchDoaSignersToSlots(signerNames, slots);
  } catch (err) {
    if (err instanceof DoaSigningLayoutError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new DoaSigningLayoutError(
      `Could not read Deed of Assignment signature lines from the PDF (${detail}).`
    );
  }
}
