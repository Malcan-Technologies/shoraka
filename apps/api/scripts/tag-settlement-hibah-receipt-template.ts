#!/usr/bin/env tsx
/**
 * Rebuild the runtime tagged Settlement & Hibah Receipt DOCX from the supplied Word source.
 *
 * Usage: pnpm --filter @cashsouk/api tag-settlement-hibah-receipt-template
 */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";

const TEMPLATES_DIR = path.resolve(
  __dirname,
  "../src/modules/notes/settlement-hibah-receipt/templates"
);
const SOURCE = path.join(TEMPLATES_DIR, "settlement-hibah-receipt-v1.source.docx");
const OUTPUT = path.join(TEMPLATES_DIR, "settlement-hibah-receipt-v1.docx");

type CellMap = Record<string, string>;

const IDENTIFIERS: CellMap = {
  "0,1": "{receiptNumber}",
  "0,3": "{receiptDate}",
  "1,1": "{issuerReference}",
  "2,1": "{issuerLegalName}",
  "2,3": "{companyRegistration}",
  "3,1": "{financingReference}",
  "3,3": "{paymasterName}",
  "4,1": "{invoiceReference}",
  "4,3": "{invoiceFaceValue}",
  "5,1": "{maturityDate}",
  "5,3": "{clearedValueDate}",
  "6,1": "{paymentReference}",
  "6,3": "{settlementStatus}",
};

const GROSS_COLLECTION: CellMap = {
  "1,2": "{grossReceiptAmount}",
};

const APPLICATION: CellMap = {
  "1,2": "{investorPrincipal}",
  "2,2": "{investorProfitGross}",
  "3,2": "{unpaidContractualFees}",
  "4,2": "{tawidhAmount}",
  "5,2": "{gharamahAmount}",
  "6,2": "{priorPaymentsCredits}",
  "7,2": "{totalApplied}",
};

const HIBAH_REFUND: CellMap = {
  "1,2": "{hibahGrossAmount}",
  "2,2": "{hibahAppliedAmount}",
  "3,2": "{hibahAmount}",
};

const RECONCILIATION: CellMap = {
  "0,1": "{investorScheduleReference}",
  "0,3": "{noteReference}",
  "1,1": "{hibahGrantor}",
  "1,3": "{hibahRecipient}",
  "2,1": "{actingThrough}",
  "3,1": "{paymentDate}",
  "3,3": "{paymentReference}",
  "4,1": "{financingSettled}",
  "4,3": "{hibahToIssuer}",
  "5,1": "{totalAllocated}",
  "5,3": "{unallocatedBalance}",
};

function encodeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

function tagDocumentXml(xml: string): string {
  const tables = matchAll(xml, /<w:tbl\b[\s\S]*?<\/w:tbl>/g);
  if (tables.length !== 7) {
    throw new Error(`Expected 7 tables in receipt source, found ${tables.length}`);
  }

  const tagged = [...tables];
  tagged[0] = applyCellMap(tables[0]!, IDENTIFIERS);
  tagged[1] = applyCellMap(tables[1]!, GROSS_COLLECTION);
  tagged[2] = applyCellMap(tables[2]!, APPLICATION);
  tagged[3] = applyCellMap(tables[3]!, HIBAH_REFUND);
  tagged[4] = applyCellMap(tables[4]!, RECONCILIATION);

  let cursor = 0;
  return xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, () => tagged[cursor++] ?? "");
}

function main(): void {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Settlement & Hibah Receipt source template not found: ${SOURCE}`);
  }
  const zip = new PizZip(fs.readFileSync(SOURCE));
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("word/document.xml missing from source DOCX");
  }
  zip.file("word/document.xml", tagDocumentXml(docFile.asText()));
  const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  fs.writeFileSync(OUTPUT, out);
  console.log(`Wrote tagged Settlement & Hibah Receipt template: ${OUTPUT}`);
}

main();
