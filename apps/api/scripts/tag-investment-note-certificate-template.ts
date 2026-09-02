#!/usr/bin/env tsx
/**
 * Rebuild the runtime tagged certificate DOCX from the supplied Word source.
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
  tagged[0] = applyCellMap(tables[0]!, IDENTIFIERS);
  tagged[1] = applyCellMap(tables[1]!, PARTICULARS);
  tagged[2] = applyCellMap(tables[2]!, LINKED_SCHEDULE);
  tagged[3] = applyCellMap(tables[3]!, PAYMENT_SCHEDULE);
  tagged[7] = applyCellMap(tables[7]!, SCHEDULE_CONTROL);
  tagged[8] = keepInvestorHeaderLoopAndTotal(
    applyCellMap(applyCellMap(tables[8]!, INVESTOR_LOOP), INVESTOR_TOTALS)
  );

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
