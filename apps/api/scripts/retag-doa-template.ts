#!/usr/bin/env tsx
/**
 * Rebuild `arf-deed-of-assignment.docx` from the clean Deed of Assignment:
 * rewrite merge slots to docxtemplater tags and replace ASSIGNOR execution
 * with one signatory/witness table per authorised representative.
 *
 * Usage: pnpm --filter @cashsouk/api retag-doa-template
 */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";

const TEMPLATES_DIR = path.resolve(__dirname, "../src/modules/applications/templates");
const CLEAN_COPY = path.join(TEMPLATES_DIR, "Deed of Assignment - Cashsouk.docx");
const OUTPUT = path.join(TEMPLATES_DIR, "arf-deed-of-assignment.docx");

const SCHEDULE1_TRUST_LABELS: Record<string, string> = {
  "Bank Name": "trust_bank_name",
  "Account Name": "trust_account_name",
  "Account No.": "trust_account_number",
  "SWIFT Code": "trust_swift_code",
};

const SCHEDULE1_ASSIGNOR_LABELS: Record<string, string> = {
  "Company Name": "assignor_company_name",
  "Registration No.": "assignor_registration_number",
  "Registered Address": "assignor_registered_address",
  "Business / Postal Address": "assignor_business_postal_address",
  "E-mail Address": "assignor_email",
  "Contact No.": "assignor_contact_number",
};

const SCHEDULE3_ROW_TAGS = [
  "transaction_document_name_number",
  "transaction_document_date",
  "debtor_name",
  "transaction_document_value",
  "due_date",
] as const;

function encodeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function paragraphPlainText(pXml: string): string {
  let text = "";
  const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^/]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = tRe.exec(pXml))) {
    if (/^<w:tab/.test(match[0])) text += "\t";
    else text += decodeXml(match[1] ?? "");
  }
  return text;
}

function compactParagraphText(text: string): string {
  return text.replace(/\t+/g, "").replace(/ +/g, " ").trim();
}

function stripHighlightFromRpr(rPr: string): string {
  return rPr
    .replace(/<w:highlight\b[^/]*\/>/g, "")
    .replace(/<w:highlight\b[\s\S]*?<\/w:highlight>/g, "");
}

function rprWithYellow(rPr: string): string {
  const base = stripHighlightFromRpr(rPr) || "<w:rPr></w:rPr>";
  if (base.includes("</w:rPr>")) {
    return base.replace("</w:rPr>", '<w:highlight w:val="yellow"/></w:rPr>');
  }
  return `<w:rPr><w:highlight w:val="yellow"/></w:rPr>`;
}

function isValueMergeTagText(text: string): boolean {
  return /^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(text.trim());
}

function bodyRpr(opts?: { bold?: boolean; underline?: boolean }): string {
  const extra = [
    opts?.bold ? "<w:b/><w:bCs/>" : "",
    opts?.underline ? '<w:u w:val="single"/>' : "",
  ].join("");
  return `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${extra}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>`;
}

function textRun(text: string, rPr: string): string {
  if (!text) return "";
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return `<w:r>${rPr}<w:t${space}>${encodeXml(text)}</w:t></w:r>`;
}

function runsFromTemplatedText(text: string, baseRpr: string): string {
  const plain = stripHighlightFromRpr(baseRpr);
  const yellow = rprWithYellow(baseRpr);
  const re = /\{[A-Za-z][A-Za-z0-9_]*\}/g;
  const runs: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      runs.push(textRun(text.slice(last, match.index), plain));
    }
    runs.push(textRun(match[0], yellow));
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    runs.push(textRun(text.slice(last), plain));
  }
  return runs.join("");
}

function firstRunRpr(pXml: string): string {
  const run = pXml.match(/<w:r\b[\s\S]*?<\/w:r>/);
  if (!run) return bodyRpr();
  const rPr = run[0].match(/<w:rPr\b[\s\S]*?<\/w:rPr>/);
  if (!rPr) return "";
  return stripHighlightFromRpr(rPr[0]);
}

function rewriteParagraphText(pXml: string, next: string): string {
  const open = pXml.match(/^<w:p\b[^>]*>/)?.[0] ?? "<w:p>";
  const pPr = pXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const rPr = firstRunRpr(pXml) || bodyRpr();
  const runs: string[] = [];
  const pieces = next.split("\t");
  pieces.forEach((piece, i) => {
    if (piece) runs.push(runsFromTemplatedText(piece, rPr));
    if (i < pieces.length - 1) {
      runs.push(`<w:r>${rPr}<w:tab/></w:r>`);
    }
  });
  return `${open}${pPr}${runs.join("")}</w:p>`;
}

function makePara(
  text: string,
  opts?: { center?: boolean; heading?: boolean; bold?: boolean }
): string {
  const jc = opts?.center || opts?.heading ? "center" : "both";
  const rPr = bodyRpr({ bold: opts?.heading || opts?.bold, underline: opts?.heading });
  return `<w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="${jc}"/>${rPr}</w:pPr>${runsFromTemplatedText(text, rPr)}</w:p>`;
}

function emptyParas(count: number): string {
  return Array.from({ length: count }, () => makePara("")).join("");
}

function pageBreakPara(): string {
  return `<w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>`;
}

function tableCell(paras: string, width: string): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>${paras}</w:tc>`;
}

function tableRow(cells: string): string {
  return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`;
}

function twoColTable(rows: Array<[string, string]>): string {
  const width = "4675";
  const body = rows
    .map(([left, right]) => tableRow(`${tableCell(left, width)}${tableCell(right, width)}`))
    .join("");
  return [
    `<w:tbl>`,
    `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`,
    `<w:tblGrid><w:gridCol w:w="4513"/><w:gridCol w:w="4513"/></w:tblGrid>`,
    body,
    `</w:tbl>`,
  ].join("");
}

function dottedSignatureRow(): [string, string] {
  return [
    makePara("..........................................................................."),
    makePara(".............................................................."),
  ];
}

function assignorSignatoryTable(): string {
  return twoColTable([
    [makePara("Signed by )"), makePara("In the presence of:")],
    [makePara("For and on behalf of )"), makePara("")],
    [makePara("{assignor_company_name} )"), makePara("")],
    [emptyParas(2), emptyParas(2)],
    dottedSignatureRow(),
    [makePara(""), makePara("[Witness]")],
    [makePara("Name: {name}"), makePara("Name:")],
    [makePara("NRIC / Passport No: {identity_number}"), makePara("Designation:")],
    [makePara("Designation: {designation}"), makePara("")],
  ]);
}

function assignorSignatoriesXml(): string {
  return [
    emptyParas(1),
    makePara("{#assignor_signatories}"),
    assignorSignatoryTable(),
    emptyParas(1),
    makePara("{/assignor_signatories}"),
    makePara("[Assignor]"),
    makePara("Company Stamp:"),
  ].join("");
}

function paragraphStartContaining(xml: string, needle: string): number {
  const idx = xml.indexOf(needle);
  if (idx < 0) throw new Error(`Could not find ${JSON.stringify(needle)} in document.xml`);
  const start = Math.max(xml.lastIndexOf("<w:p ", idx), xml.lastIndexOf("<w:p>", idx));
  if (start < 0) throw new Error(`Could not find paragraph start for ${JSON.stringify(needle)}`);
  return start;
}

function paragraphEndAfter(xml: string, start: number): number {
  const end = xml.indexOf("</w:p>", start);
  if (end < 0) throw new Error("Unclosed paragraph while tagging Deed of Assignment");
  return end + "</w:p>".length;
}

function rebuildAssignorExecution(xml: string): string {
  const headingStart = paragraphStartContaining(xml, "MINIMUM OF TWO");
  const headingEnd = paragraphEndAfter(xml, headingStart);
  const originalHeading = xml.slice(headingStart, headingEnd);
  const scheduleStart = paragraphStartContaining(xml, "SCHEDULE 1");
  if (scheduleStart <= headingEnd) {
    throw new Error("ASSIGNOR execution heading is not before SCHEDULE 1");
  }
  return (
    xml.slice(0, headingStart) +
    originalHeading +
    assignorSignatoriesXml() +
    pageBreakPara() +
    xml.slice(scheduleStart)
  );
}

function isAssignorNameParagraph(compact: string): boolean {
  return compact === "Name:";
}

function isAssignorDesignationParagraph(compact: string): boolean {
  return compact === "Designation:";
}

type WalkState = {
  schedule1Section: "none" | "ssp" | "trust" | "assignor" | "finance";
  pendingSchedule1Tag: string | null;
  inSchedule2: boolean;
  seenAcknowledgment: boolean;
  noticeNameTagged: boolean;
  noticeDesignationTagged: boolean;
  ackNameTagged: boolean;
  ackDesignationTagged: boolean;
};

function transformParagraph(pXml: string, state: WalkState): string {
  const text = paragraphPlainText(pXml);
  const compact = compactParagraphText(text);

  if (compact.startsWith("SCHEDULE 1")) {
    state.schedule1Section = "ssp";
    state.pendingSchedule1Tag = null;
    return pXml;
  }
  if (compact.startsWith("SCHEDULE 2")) {
    state.schedule1Section = "none";
    state.pendingSchedule1Tag = null;
    state.inSchedule2 = true;
    return pXml;
  }
  if (compact.startsWith("SCHEDULE 3")) {
    state.inSchedule2 = false;
    state.schedule1Section = "none";
    return pXml;
  }

  if (state.pendingSchedule1Tag) {
    const tag = state.pendingSchedule1Tag;
    state.pendingSchedule1Tag = null;
    if (!compact) {
      return rewriteParagraphText(pXml, `{${tag}}`);
    }
  }

  if (state.schedule1Section !== "none") {
    if (compact === "PAYMENT TRUST ACCOUNT DETAILS") {
      state.schedule1Section = "trust";
      return pXml;
    }
    if (compact === "ASSIGNOR") {
      state.schedule1Section = "assignor";
      return pXml;
    }
    if (compact === "FINANCE DOCUMENTS") {
      state.schedule1Section = "finance";
      return pXml;
    }
    if (state.schedule1Section === "trust" && SCHEDULE1_TRUST_LABELS[compact]) {
      state.pendingSchedule1Tag = SCHEDULE1_TRUST_LABELS[compact];
      return pXml;
    }
    if (state.schedule1Section === "assignor" && SCHEDULE1_ASSIGNOR_LABELS[compact]) {
      state.pendingSchedule1Tag = SCHEDULE1_ASSIGNOR_LABELS[compact];
      return pXml;
    }
    return pXml;
  }

  if (compact.startsWith("THIS DEED OF ASSIGNMENT") && compact.includes("is made on")) {
    if (text.includes("{assignment_date}")) return pXml;
    const next = `${text.replace(/\s+$/, "")} {assignment_date}`;
    return rewriteParagraphText(pXml, next);
  }

  if (!state.inSchedule2) return pXml;

  if (compact.includes("[insert date]")) {
    return rewriteParagraphText(pXml, text.replace("[insert date]", "{notice_date}"));
  }
  if (compact.includes("[Name & Address of Debtor]")) {
    return rewriteParagraphText(
      pXml,
      text.replace("[Name & Address of Debtor]", "{debtor_company_name}, {debtor_address}")
    );
  }
  if (compact === "Attn:") {
    return rewriteParagraphText(pXml, `${text} {debtor_attention}`);
  }
  if (compact.includes("effective from [insert]")) {
    return rewriteParagraphText(pXml, text.replace("[insert]", "{assignment_date}"));
  }
  if (compact.includes("Account Name") && compact.includes("[Insert]")) {
    return rewriteParagraphText(pXml, text.replace("[Insert]", "{trust_account_name}"));
  }
  if (compact.includes("Account Bank") && compact.includes("[Insert]")) {
    return rewriteParagraphText(pXml, text.replace("[Insert]", "{trust_bank_name}"));
  }
  if (compact.includes("Account No.") && compact.includes("[Insert]")) {
    return rewriteParagraphText(pXml, text.replace("[Insert]", "{trust_account_number}"));
  }
  if (compact === "ACKNOWLEDGMENT" || compact === "ACKNOWLEDGEMENT") {
    state.seenAcknowledgment = true;
    return pXml;
  }
  if (text.includes("RM_____________") || text.includes("as at ________________")) {
    const next = text
      .replace("RM_____________", "RM{outstanding_amount}")
      .replace("as at ________________", "as at {balance_as_of_date}");
    return rewriteParagraphText(pXml, next);
  }
  if (compact === "[Company Name]") {
    return rewriteParagraphText(pXml, text.replace("[Company Name]", "{debtor_company_name}"));
  }
  if (compact.startsWith("(Registration No.)")) {
    if (text.includes("{debtor_registration_number}")) return pXml;
    return rewriteParagraphText(pXml, "(Registration No. {debtor_registration_number})");
  }
  if (isAssignorNameParagraph(compact)) {
    if (!state.seenAcknowledgment && !state.noticeNameTagged) {
      state.noticeNameTagged = true;
      return rewriteParagraphText(pXml, `${text} {notice_signatory_name}`);
    }
    if (state.seenAcknowledgment && !state.ackNameTagged) {
      state.ackNameTagged = true;
      return rewriteParagraphText(pXml, `${text} {debtor_signatory_name}`);
    }
  }
  if (isAssignorDesignationParagraph(compact)) {
    if (!state.seenAcknowledgment && !state.noticeDesignationTagged) {
      state.noticeDesignationTagged = true;
      return rewriteParagraphText(pXml, `${text} {notice_signatory_designation}`);
    }
    if (state.seenAcknowledgment && !state.ackDesignationTagged) {
      state.ackDesignationTagged = true;
      return rewriteParagraphText(pXml, `${text} {debtor_signatory_designation}`);
    }
  }
  if (state.seenAcknowledgment && compact === "Date:") {
    return rewriteParagraphText(pXml, `${text} {acknowledgement_date}`);
  }

  return pXml;
}

function rewriteBodyParagraphs(xml: string): string {
  const state: WalkState = {
    schedule1Section: "none",
    pendingSchedule1Tag: null,
    inSchedule2: false,
    seenAcknowledgment: false,
    noticeNameTagged: false,
    noticeDesignationTagged: false,
    ackNameTagged: false,
    ackDesignationTagged: false,
  };
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (pXml) => transformParagraph(pXml, state));
}

function findTables(xml: string): Array<{ start: number; end: number }> {
  const tables: Array<{ start: number; end: number }> = [];
  let searchFrom = 0;
  while (searchFrom < xml.length) {
    const start = xml.indexOf("<w:tbl", searchFrom);
    if (start < 0) break;
    const end = xml.indexOf("</w:tbl>", start);
    if (end < 0) throw new Error("Unclosed table in document.xml");
    tables.push({ start, end: end + "</w:tbl>".length });
    searchFrom = end + 8;
  }
  return tables;
}

function rewriteSchedule3Table(xml: string): string {
  const tables = findTables(xml);
  for (const table of tables) {
    const tbl = xml.slice(table.start, table.end);
    if (!tbl.includes("Due Date") || !tbl.includes("Transaction Document")) continue;

    const rows: string[] = [];
    const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
    let match: RegExpExecArray | null;
    while ((match = rowRe.exec(tbl))) {
      rows.push(match[0]);
    }
    if (rows.length < 2) {
      throw new Error("Schedule 3 table does not have a data row to tag");
    }

    const header = rows[0];
    const templateRow = rows[1];
    const cells: string[] = [];
    const cellRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(templateRow))) {
      cells.push(cellMatch[0]);
    }
    if (cells.length !== SCHEDULE3_ROW_TAGS.length) {
      throw new Error(
        `Schedule 3 data row has ${cells.length} cells, expected ${SCHEDULE3_ROW_TAGS.length}`
      );
    }

    const taggedCells = cells.map((cell, index) => {
      const tag = SCHEDULE3_ROW_TAGS[index];
      let prefix = "";
      let suffix = "";
      if (index === 0) prefix = "{#transaction_documents}";
      if (index === cells.length - 1) suffix = "{/transaction_documents}";
      return cell.replace(/<w:p\b[\s\S]*?<\/w:p>/, (pXml) =>
        rewriteParagraphText(pXml, `${prefix}{${tag}}${suffix}`)
      );
    });

    const taggedRow = templateRow.replace(
      /(<w:tr\b[^>]*>)[\s\S]*$/,
      `$1${taggedCells.join("")}</w:tr>`
    );
    const firstRowEnd = tbl.indexOf("</w:tr>") + "</w:tr>".length;
    const nextTbl = tbl.slice(0, firstRowEnd).replace(rows[0], header) + taggedRow + "</w:tbl>";
    return xml.slice(0, table.start) + nextTbl + xml.slice(table.end);
  }
  throw new Error("Could not find Schedule 3 transaction-documents table");
}

function ensureYellowOnValueTagRuns(xml: string): string {
  return xml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    if (!isValueMergeTagText(runPlainText(run))) return run;
    if (run.includes('w:val="yellow"')) return run;
    if (run.includes("<w:rPr>")) {
      return run.replace(/<\/w:rPr>/, '<w:highlight w:val="yellow"/></w:rPr>');
    }
    return run.replace(/(<w:r\b[^>]*>)/, `$1<w:rPr><w:highlight w:val="yellow"/></w:rPr>`);
  });
}

function runPlainText(runXml: string): string {
  let text = "";
  const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = tRe.exec(runXml))) {
    text += decodeXml(match[1] ?? "");
  }
  return text;
}

function valueTagsMissingHighlight(xml: string): string[] {
  const missing: string[] = [];
  const runRe = /<w:r\b[\s\S]*?<\/w:r>/g;
  let match: RegExpExecArray | null;
  while ((match = runRe.exec(xml))) {
    const run = match[0];
    const text = runPlainText(run).trim();
    if (isValueMergeTagText(text) && !run.includes('w:val="yellow"')) {
      missing.push(text);
    }
  }
  return missing;
}

function requiredTagsPresent(xml: string): string[] {
  const required = [
    "{assignment_date}",
    "{assignor_company_name}",
    "{assignor_registration_number}",
    "{assignor_registered_address}",
    "{assignor_business_postal_address}",
    "{assignor_email}",
    "{assignor_contact_number}",
    "{#assignor_signatories}",
    "{name}",
    "{identity_number}",
    "{designation}",
    "{/assignor_signatories}",
    "{trust_bank_name}",
    "{trust_account_name}",
    "{trust_account_number}",
    "{trust_swift_code}",
    "{debtor_company_name}",
    "{debtor_registration_number}",
    "{debtor_address}",
    "{debtor_attention}",
    "{notice_date}",
    "{notice_signatory_name}",
    "{notice_signatory_designation}",
    "{outstanding_amount}",
    "{balance_as_of_date}",
    "{debtor_signatory_name}",
    "{debtor_signatory_designation}",
    "{acknowledgement_date}",
    "{#transaction_documents}",
    "{transaction_document_name_number}",
    "{transaction_document_date}",
    "{debtor_name}",
    "{transaction_document_value}",
    "{due_date}",
    "{/transaction_documents}",
    "In the presence of:",
    "[Witness]",
    "[Assignor]",
    "Company Stamp:",
  ];
  return required.filter((tag) => !xml.includes(tag));
}

function leftoverPlaceholders(xml: string): string[] {
  const text = xml.replace(/<[^>]+>/g, "");
  const found: string[] = [];
  for (const pat of [
    "[insert date]",
    "[insert]",
    "[Insert]",
    "[Name & Address of Debtor]",
    "[Company Name]",
    "[ASSIGNOR]",
    "ELECTRONIC SIGNATURES",
  ]) {
    if (text.includes(pat) || xml.includes(pat)) found.push(pat);
  }
  return found;
}

function main(): void {
  if (!fs.existsSync(CLEAN_COPY)) {
    throw new Error(`Clean copy not found: ${CLEAN_COPY}`);
  }

  const cleanZip = new PizZip(fs.readFileSync(CLEAN_COPY));
  let documentXml = cleanZip.file("word/document.xml")?.asText();
  if (!documentXml) throw new Error("Clean copy is missing word/document.xml");

  documentXml = rewriteBodyParagraphs(documentXml);
  documentXml = rewriteSchedule3Table(documentXml);
  documentXml = rebuildAssignorExecution(documentXml);
  documentXml = ensureYellowOnValueTagRuns(documentXml);

  const missing = requiredTagsPresent(documentXml);
  if (missing.length > 0) {
    throw new Error(`Tagged document.xml is missing: ${missing.join(", ")}`);
  }
  if (!documentXml.includes('w:val="yellow"')) {
    throw new Error("Tagged document has no yellow highlighting on merge tags");
  }
  const unhighlighted = valueTagsMissingHighlight(documentXml);
  if (unhighlighted.length > 0) {
    throw new Error(`Value merge tags missing yellow highlight: ${unhighlighted.join(", ")}`);
  }
  const leftovers = leftoverPlaceholders(documentXml);
  if (leftovers.length > 0) {
    throw new Error(`Leftover placeholders in document.xml: ${leftovers.join(", ")}`);
  }
  const stillHasDebtorMarker = [...documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].some(
    (match) => compactParagraphText(paragraphPlainText(match[0])) === "[Debtor]"
  );
  if (!stillHasDebtorMarker) {
    throw new Error("Legal copy [Debtor] sender marker was removed");
  }

  const out = new PizZip(fs.readFileSync(CLEAN_COPY));
  out.file("word/document.xml", documentXml);

  const bytes = out.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  fs.writeFileSync(OUTPUT, bytes);

  const tblCount = (documentXml.match(/<w:tbl\b/g) ?? []).length;
  const loopStarts = (documentXml.match(/\{#/g) ?? []).length;
  console.log(`Wrote ${OUTPUT}`);
  console.log(`document.xml tables=${tblCount} loop-starts=${loopStarts} bytes=${bytes.length}`);
}

main();
