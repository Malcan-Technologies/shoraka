#!/usr/bin/env tsx
/**
 * Rebuild the runtime tagged certificate DOCX from the supplied Word source.
 * Admin/Investor keep the 7-column allocation table; issuer gets a 6-column
 * sibling table (no Investor / Noteholder column) selected at render time.
 * Investor copy omits the Issuer legal name / Company no. identifier row.
 *
 * Usage: pnpm --filter @cashsouk/api tag-investment-note-certificate-template
 */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";

const TEMPLATES_DIR = path.resolve(
  __dirname,
  "../src/modules/notes/investment-note-certificate/templates"
);
const SOURCE = path.join(TEMPLATES_DIR, "islamic-investment-note-certificate-v1.source.docx");
const OUTPUT = path.join(TEMPLATES_DIR, "islamic-investment-note-certificate-v1.docx");

type CellMap = Record<string, string>;

const IDENTIFIERS: CellMap = {
  "0,1": "{certificateNumber}",
  "0,3": "{certificateDate}",
  "1,1": "{noteReference}",
  "1,3": "{campaignId}",
  "2,1": "{issuerReference}",
  "2,3": "{businessSector}",
  "3,1": "{issuerLegalName}",
  "3,3": "{companyRegistration}",
};

const PARTICULARS: CellMap = {
  "0,1": "{campaignStatus}",
  "0,3": "{fundingCloseDate}",
  "1,1": "{targetAmount}",
  "1,3": "{fundedAmount}",
  "2,1": "{principalAmount}",
  "2,3": "{currency}",
  "3,1": "{profitRate}",
  "3,3": "{contractedProfit}",
  "4,1": "{totalPayable}",
  "4,3": "{repaymentProfile}",
  "5,1": "{issueDate}",
  "5,3": "{disbursementDate}",
  "6,1": "{tenure}",
  "6,3": "{maturityDate}",
  "7,1": "{shariahStructure}",
  "7,3": "{riskRating}",
  "8,1": "{invoiceReference}",
  "8,3": "{paymasterName}",
  "9,1": "{financingPurpose}",
  "9,3": "{securitySupport}",
};

const LINKED_SCHEDULE: CellMap = {
  "0,1": "{investorScheduleReference}",
  "0,3": "{scheduleStatus}",
};

const PAYMENT_SCHEDULE: CellMap = {
  "1,0": "{paymentMaturityDate}",
  "1,1": "{paymentPrincipal}",
  "1,2": "{paymentExpectedProfit}",
  "1,3": "{paymentTotalPayable}",
};

const SCHEDULE_CONTROL: CellMap = {
  "0,1": "{noteReference}",
  "0,3": "{investorScheduleReference}",
  "1,1": "{scheduleVersion}",
  "1,3": "{scheduleStatus}",
  "2,1": "{scheduleIssueDate}",
  "2,3": "{scheduleEffectiveDate}",
  "3,1": "{issuerReference}",
  "3,3": "{fundedPrincipal}",
};

const INVESTOR_LOOP: CellMap = {
  "1,0": "{#investors}{rowNumber}",
  "1,1": "{investorId}",
  "1,2": "{investorName}",
  "1,3": "{principal}",
  "1,4": "{sharePercent}",
  "1,5": "{expectedProfit}",
  "1,6": "{lineTotalPayable}{/investors}",
};

const INVESTOR_TOTALS: CellMap = {
  "11,3": "{sumPrincipal}",
  "11,4": "{sumSharePercent}",
  "11,5": "{sumExpectedProfit}",
  "11,6": "{sumTotalPayable}",
};

const NAME_COLUMN_INDEX = 2;
const EMPTY_INVESTOR_ID_TOTAL_COLUMN_INDEX = 1;
const ISSUER_ALLOCATION_WIDTHS = [450, 2500, 1620, 850, 1840, 1980];

function encodeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function cellPlainText(cellXml: string): string {
  let text = "";
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cellXml))) {
    text += decodeXml(match[1] ?? "");
  }
  return text;
}

function wrapTableRowInCondition(tableXml: string, rowIndex: number, condition: string): string {
  const rows = matchAll(tableXml, /<w:tr\b[\s\S]*?<\/w:tr>/g);
  if (rowIndex < 0 || rowIndex >= rows.length) {
    throw new Error(`Cannot wrap table row ${rowIndex}; table has ${rows.length} rows`);
  }
  const rowXml = rows[rowIndex]!;
  const cells = matchAll(rowXml, /<w:tc\b[\s\S]*?<\/w:tc>/g);
  if (cells.length < 2) {
    throw new Error(`Conditional table row ${rowIndex} expected at least 2 cells`);
  }
  const rowText = cells.map(cellPlainText).join(" ");
  if (!rowText.includes("Issuer") || !rowText.includes("Company no.")) {
    throw new Error(
      `Expected identifiers row ${rowIndex} to be Issuer / Company no., found: ${rowText}`
    );
  }
  const updatedCells = [...cells];
  updatedCells[0] = setFirstParagraphText(cells[0]!, `{#${condition}}${cellPlainText(cells[0]!)}`);
  updatedCells[cells.length - 1] = setFirstParagraphText(
    cells[cells.length - 1]!,
    `${cellPlainText(cells[cells.length - 1]!)}{/${condition}}`
  );
  let cellCursor = 0;
  const wrappedRow = rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, () => updatedCells[cellCursor++] ?? "");
  let rowCursor = 0;
  return tableXml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, () => {
    const current = rowCursor++;
    return current === rowIndex ? wrappedRow : rows[current] ?? "";
  });
}

function matchAll(xml: string, pattern: RegExp): string[] {
  return xml.match(pattern) ?? [];
}

function setFirstParagraphText(tcXml: string, text: string): string {
  const pMatch = tcXml.match(/<w:p\b[\s\S]*?<\/w:p>/);
  if (!pMatch) {
    throw new Error(`Cell has no paragraph for tag ${text}`);
  }
  const pXml = pMatch[0];
  const pOpen = pXml.match(/^<w:p\b[^>]*>/)?.[0];
  if (!pOpen) {
    throw new Error(`Could not parse paragraph open for tag ${text}`);
  }
  const pPr = pXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const rPr = pXml.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  const newP = `${pOpen}${pPr}<w:r>${rPr}<w:t${space}>${encodeXml(text)}</w:t></w:r></w:p>`;
  return tcXml.replace(pXml, newP);
}

function applyCellMap(tableXml: string, map: CellMap): string {
  const rows = matchAll(tableXml, /<w:tr\b[\s\S]*?<\/w:tr>/g);
  const updatedRows = rows.map((rowXml, rowIndex) => {
    const cells = matchAll(rowXml, /<w:tc\b[\s\S]*?<\/w:tc>/g);
    const updatedCells = cells.map((cellXml, colIndex) => {
      const tag = map[`${rowIndex},${colIndex}`];
      return tag ? setFirstParagraphText(cellXml, tag) : cellXml;
    });
    let cursor = 0;
    return rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, () => updatedCells[cursor++] ?? "");
  });
  let cursor = 0;
  return tableXml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, () => updatedRows[cursor++] ?? "");
}

function replaceRowCells(rowXml: string, cells: string[]): string {
  let cursor = 0;
  return rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, () => cells[cursor++] ?? "");
}

function setCellWidth(cellXml: string, width: number): string {
  if (/<w:tcW\b[^/]*\/>/.test(cellXml)) {
    return cellXml.replace(/<w:tcW\b[^/]*\/>/, `<w:tcW w:w="${width}" w:type="dxa"/>`);
  }
  return cellXml.replace(/<w:tcPr\b[^>]*>/, (open) => `${open}<w:tcW w:w="${width}" w:type="dxa"/>`);
}

function applyRowWidths(rowXml: string, widths: number[]): string {
  const cells = matchAll(rowXml, /<w:tc\b[\s\S]*?<\/w:tc>/g);
  if (cells.length !== widths.length) {
    throw new Error(`Expected ${widths.length} allocation cells, found ${cells.length}`);
  }
  const updated = cells.map((cellXml, index) => setCellWidth(cellXml, widths[index]!));
  return replaceRowCells(rowXml, updated);
}

function applyTableWidths(tableXml: string, widths: number[]): string {
  const grid = `<w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>`;
  const withGrid = tableXml.replace(/<w:tblGrid\b[\s\S]*?<\/w:tblGrid>/, grid);
  const rows = matchAll(withGrid, /<w:tr\b[\s\S]*?<\/w:tr>/g);
  const updatedRows = rows.map((rowXml) => applyRowWidths(rowXml, widths));
  let cursor = 0;
  return withGrid.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, () => updatedRows[cursor++] ?? "");
}

function removeRowCell(rowXml: string, colIndex: number): string {
  const cells = matchAll(rowXml, /<w:tc\b[\s\S]*?<\/w:tc>/g);
  if (colIndex < 0 || colIndex >= cells.length) {
    throw new Error(`Cannot remove allocation column ${colIndex} from a ${cells.length}-cell row`);
  }
  const kept = cells.filter((_, index) => index !== colIndex);
  let sourceIndex = 0;
  return rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, () => {
    const index = sourceIndex++;
    if (index === colIndex) return "";
    return kept[index < colIndex ? index : index - 1] ?? "";
  });
}

function conditionParagraph(tag: string): string {
  return (
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>` +
    `<w:rPr><w:vanish/><w:sz w:val="2"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:vanish/><w:sz w:val="2"/></w:rPr>` +
    `<w:t>${encodeXml(`{${tag}}`)}</w:t></w:r></w:p>`
  );
}

function wrapInAudienceCondition(tableXml: string, openTag: string, closeTag: string): string {
  return `${conditionParagraph(openTag)}${tableXml}${conditionParagraph(closeTag)}`;
}

function toIssuerAllocationTable(namedTableXml: string): string {
  const rows = matchAll(namedTableXml, /<w:tr\b[\s\S]*?<\/w:tr>/g);
  if (rows.length !== 3) {
    throw new Error(`Named allocation table expected 3 rows, found ${rows.length}`);
  }
  const header = removeRowCell(rows[0]!, NAME_COLUMN_INDEX);
  const loop = removeRowCell(rows[1]!, NAME_COLUMN_INDEX);
  const total = removeRowCell(rows[2]!, EMPTY_INVESTOR_ID_TOTAL_COLUMN_INDEX);
  const updatedRows = [header, loop, total];
  let cursor = 0;
  const withoutNameColumn = namedTableXml.replace(
    /<w:tr\b[\s\S]*?<\/w:tr>/g,
    () => updatedRows[cursor++] ?? ""
  );
  return applyTableWidths(withoutNameColumn, ISSUER_ALLOCATION_WIDTHS);
}

function keepInvestorHeaderLoopAndTotal(tableXml: string): string {
  const rows = matchAll(tableXml, /<w:tr\b[\s\S]*?<\/w:tr>/g);
  if (rows.length < 3) {
    throw new Error(`Investor allocation table expected 12+ rows, got ${rows.length}`);
  }
  const kept = [rows[0], rows[1], rows[rows.length - 1]];
  let cursor = 0;
  return tableXml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, () => {
    if (cursor === 0) {
      cursor += 1;
      return kept[0] ?? "";
    }
    if (cursor === 1) {
      cursor += 1;
      return kept[1] ?? "";
    }
    if (cursor === rows.length - 1) {
      cursor += 1;
      return kept[2] ?? "";
    }
    cursor += 1;
    return "";
  });
}

function tagDocumentXml(xml: string): string {
  const tables = matchAll(xml, /<w:tbl\b[\s\S]*?<\/w:tbl>/g);
  if (tables.length !== 10) {
    throw new Error(`Expected 10 tables in certificate source, found ${tables.length}`);
  }

  const tagged = [...tables];
  tagged[0] = wrapTableRowInCondition(applyCellMap(tables[0]!, IDENTIFIERS), 3, "showIssuerLegalIdentity");
  tagged[1] = applyCellMap(tables[1]!, PARTICULARS);
  tagged[2] = applyCellMap(tables[2]!, LINKED_SCHEDULE);
  tagged[3] = applyCellMap(tables[3]!, PAYMENT_SCHEDULE);
  tagged[7] = applyCellMap(tables[7]!, SCHEDULE_CONTROL);
  const namedAllocation = keepInvestorHeaderLoopAndTotal(
    applyCellMap(applyCellMap(tables[8]!, INVESTOR_LOOP), INVESTOR_TOTALS)
  );
  const issuerAllocation = toIssuerAllocationTable(namedAllocation);
  tagged[8] =
    wrapInAudienceCondition(namedAllocation, "^isIssuerAudience", "/isIssuerAudience") +
    wrapInAudienceCondition(issuerAllocation, "#isIssuerAudience", "/isIssuerAudience");

  let cursor = 0;
  return xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, () => tagged[cursor++] ?? "");
}

function main(): void {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Certificate source template not found: ${SOURCE}`);
  }
  const zip = new PizZip(fs.readFileSync(SOURCE));
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("word/document.xml missing from source DOCX");
  }
  zip.file("word/document.xml", tagDocumentXml(docFile.asText()));
  const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  fs.writeFileSync(OUTPUT, out);
  console.log(`Wrote tagged certificate template: ${OUTPUT}`);
}

main();
