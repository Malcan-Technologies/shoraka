#!/usr/bin/env tsx
/**
 * Rebuild `arf-joint-several-guarantee.docx` from the 16 July 2026 clean JSG:
 * rewrite merge slots to docxtemplater tags and replace the two hardcoded
 * execution blocks + Schedule 1 with loops (individuals, corporate blocks).
 * Individual and corporate execution blocks flow onto shared pages. The
 * OPERATOR page is copied from the clean JSG (fixed layout: hanging
 * parentheses, two attorneys on the right, one witness on the left).
 * Schedule 1 still starts on its own page.
 *
 * Usage: pnpm --filter @cashsouk/api retag-jsg-template
 */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";

const TEMPLATES_DIR = path.resolve(__dirname, "../src/modules/applications/templates");
const CLEAN_COPY = path.join(TEMPLATES_DIR, "Clean - JSG (16 July 2026).docx");
const OUTPUT = path.join(TEMPLATES_DIR, "arf-joint-several-guarantee.docx");

/** Dedicated list so Schedule 1 guarantors restart at i. (not continuing body lists). */
const SCHEDULE_GUARANTOR_NUM_ID = "20";
const SCHEDULE_GUARANTOR_ABSTRACT_ID = "20";

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
  return `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${extra}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>`;
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
  const rPr = firstRunRpr(pXml);
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

function listItemPara(text: string, ilvl: "0" | "1"): string {
  const rPr = bodyRpr();
  const left = ilvl === "0" ? "885" : "1900";
  const hanging = ilvl === "0" ? "141" : "360";
  const pPr = `<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${SCHEDULE_GUARANTOR_NUM_ID}"/></w:numPr><w:spacing w:line="360" w:lineRule="auto"/><w:ind w:left="${left}" w:hanging="${hanging}"/><w:jc w:val="both"/>${rPr}</w:pPr>`;
  return `<w:p>${pPr}${runsFromTemplatedText(text, rPr)}</w:p>`;
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

function individualExecutionTable(): string {
  return twoColTable([
    [emptyParas(2), emptyParas(2)],
    dottedSignatureRow(),
    [makePara("Signature of Guarantor"), makePara("Signature of Witness")],
    [makePara("Full Name: {name}"), makePara("Full Name:")],
    [makePara("NRIC No.: {nric}"), makePara("NRIC No.:")],
    [makePara("Date: ________________"), makePara("Date: ________________")],
  ]);
}

function scheduleXml(): string {
  return [
    makePara("SCHEDULE 1", { heading: true }),
    emptyParas(1),
    makePara("1. THE DATE OF THIS GUARANTEE", { bold: true }),
    makePara("{guarantee_date}"),
    emptyParas(1),
    makePara("2. NAME, DESCRIPTION AND PERMANENT ADDRESS OF THE GUARANTOR(S)", { bold: true }),
    makePara("{#schedule_guarantors}"),
    listItemPara("{line}", "0"),
    makePara("{#representatives}"),
    listItemPara("{rep_line}", "1"),
    makePara("{/representatives}"),
    makePara("{/schedule_guarantors}"),
    emptyParas(1),
    makePara("3. THE FACILITY", { bold: true }),
    makePara("{facility_description}"),
    emptyParas(1),
    makePara("4. NAME, REGISTRATION NUMBER AND REGISTERED ADDRESS OF THE ISSUER", { bold: true }),
    makePara("{issuer_name} (Registration No. {issuer_registration_number})"),
    makePara("Registered Address: {issuer_address}"),
    makePara("Business Address: {issuer_business_address}"),
    emptyParas(1),
    makePara("[The remaining space of this page has been left blank intentionally]", { center: true }),
  ].join("");
}

function executionGuarantorsXml(): string {
  return [
    makePara("EXECUTION PAGE", { heading: true }),
    makePara(
      "IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above."
    ),
    emptyParas(1),
    makePara("{#has_individual_guarantors}"),
    makePara("{#guarantors_individual}"),
    makePara("The Guarantor(s)", { bold: true }),
    emptyParas(1),
    individualExecutionTable(),
    emptyParas(1),
    makePara("{/guarantors_individual}"),
    makePara("{/has_individual_guarantors}"),
    makePara("{#has_corporate_guarantor}"),
    makePara("{#corporate_guarantor_pages}"),
    makePara("The Guarantor(s)", { bold: true }),
    makePara("For and on behalf of {company_name}"),
    makePara("{company_ssm}"),
    makePara("in the presence of:-"),
    makePara("{#signatories}"),
    individualExecutionTable(),
    emptyParas(1),
    makePara("{/signatories}"),
    makePara("{/corporate_guarantor_pages}"),
    makePara("{/has_corporate_guarantor}"),
  ].join("");
}

function compactParagraphText(text: string): string {
  return text.replace(/\t+/g, "");
}

function applyOpeningText(text: string): string {
  const compact = compactParagraphText(text);
  const from = "made onby the persons whose details are as set out in Appendix 1";
  const to = "made on {guarantee_date} by the persons whose details are as set out in Schedule 1";
  if (!compact.includes(from)) {
    throw new Error(`Opening paragraph did not contain ${JSON.stringify(from)}`);
  }
  return compact.split(from).join(to);
}

function applyRecitalText(text: string): string {
  const compact = compactParagraphText(text);
  let next = compact.replace(
    /dated _{8,} \(Ref\. No\.: _{8,}\)/,
    "dated {letter_date} (Ref. No.: {our_reference})"
  );
  next = next.split("[Issuer, Registration No. & Address]").join(
    "{issuer_name} (Registration No. {issuer_registration_number}) of {issuer_address}"
  );
  if (!next.includes("{letter_date}") || !next.includes("{issuer_name}")) {
    throw new Error(`Recital paragraph was not tagged: ${compact.slice(0, 180)}`);
  }
  return next;
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
  if (end < 0) throw new Error("Unclosed paragraph while tagging JSG");
  return end + "</w:p>".length;
}

function rewriteParagraphContaining(
  xml: string,
  needle: string,
  transform: (text: string) => string
): string {
  const start = paragraphStartContaining(xml, needle);
  const end = paragraphEndAfter(xml, start);
  const pXml = xml.slice(start, end);
  const next = transform(paragraphPlainText(pXml));
  return xml.slice(0, start) + rewriteParagraphText(pXml, next) + xml.slice(end);
}

function rebuildExecutionAndSchedule(xml: string): string {
  const execStart = paragraphStartContaining(xml, "EXECUTION PAGE");
  const operatorStart = paragraphStartContaining(xml, "OPERATOR");
  const scheduleStart = paragraphStartContaining(xml, "SCHEDULE 1");
  const sectPrStart = xml.lastIndexOf("<w:sectPr");
  if (sectPrStart < 0 || sectPrStart <= execStart) {
    throw new Error("sectPr is missing or is not after EXECUTION PAGE");
  }
  if (operatorStart <= execStart || scheduleStart <= operatorStart || sectPrStart <= scheduleStart) {
    throw new Error("EXECUTION PAGE, OPERATOR, and SCHEDULE 1 are not in expected order");
  }
  const originalOperator = xml.slice(operatorStart, scheduleStart);
  return (
    xml.slice(0, execStart) +
    executionGuarantorsXml() +
    pageBreakPara() +
    originalOperator +
    scheduleXml() +
    xml.slice(sectPrStart)
  );
}

function stripYellowHighlights(xml: string): string {
  return xml
    .replace(/<w:highlight\b[^/]*\/>/g, "")
    .replace(/<w:highlight\b[\s\S]*?<\/w:highlight>/g, "");
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

function leftoverPlaceholders(xml: string): string[] {
  const text = xml.replace(/<[^>]+>/g, "");
  const found: string[] = [];
  for (const pat of [
    "Appendix 1",
    "[Issuer",
    "made onby",
    "GUARANTOR’S NAME",
    "ISSUER’S NAME",
  ]) {
    if (text.includes(pat) || xml.includes(pat)) found.push(pat);
  }
  return found;
}

function requiredTagsPresent(xml: string): string[] {
  const required = [
    "{guarantee_date}",
    "{letter_date}",
    "{our_reference}",
    "{issuer_name}",
    "{issuer_registration_number}",
    "{issuer_address}",
    "{issuer_business_address}",
    "{facility_description}",
    "{#schedule_guarantors}",
    "{line}",
    "{rep_line}",
    "{/schedule_guarantors}",
    "{#has_individual_guarantors}",
    "{#guarantors_individual}",
    "{name}",
    "{nric}",
    "{#has_corporate_guarantor}",
    "{#corporate_guarantor_pages}",
    "{company_name}",
    "{company_ssm}",
    "{#signatories}",
  ];
  return required.filter((tag) => !xml.includes(tag));
}

function graftScheduleNumbering(numberingXml: string): string {
  if (numberingXml.includes(`w:abstractNumId="${SCHEDULE_GUARANTOR_ABSTRACT_ID}"`)) {
    throw new Error(`numbering.xml already has abstractNumId ${SCHEDULE_GUARANTOR_ABSTRACT_ID}`);
  }
  const abstract = [
    `<w:abstractNum w:abstractNumId="${SCHEDULE_GUARANTOR_ABSTRACT_ID}">`,
    `<w:multiLevelType w:val="hybridMultilevel"/>`,
    `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>`,
    `<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl>`,
    `</w:abstractNum>`,
  ].join("");
  const num = `<w:num w:numId="${SCHEDULE_GUARANTOR_NUM_ID}"><w:abstractNumId w:val="${SCHEDULE_GUARANTOR_ABSTRACT_ID}"/></w:num>`;
  const firstNum = numberingXml.indexOf("<w:num ");
  if (firstNum < 0) throw new Error("numbering.xml has no w:num entries");
  if (!numberingXml.includes("</w:numbering>")) {
    throw new Error("numbering.xml is missing </w:numbering>");
  }
  return (
    numberingXml.slice(0, firstNum) +
    abstract +
    numberingXml.slice(firstNum).replace("</w:numbering>", `${num}</w:numbering>`)
  );
}

function main(): void {
  if (!fs.existsSync(CLEAN_COPY)) {
    throw new Error(`Clean copy not found: ${CLEAN_COPY}`);
  }

  const cleanZip = new PizZip(fs.readFileSync(CLEAN_COPY));
  let documentXml = cleanZip.file("word/document.xml")?.asText();
  if (!documentXml) throw new Error("Clean copy is missing word/document.xml");

  documentXml = stripYellowHighlights(documentXml);
  documentXml = rewriteParagraphContaining(documentXml, "Appendix 1", applyOpeningText);
  documentXml = rewriteParagraphContaining(documentXml, "Pursuant to the letter", applyRecitalText);
  documentXml = rebuildExecutionAndSchedule(documentXml);
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

  const numberingXml = cleanZip.file("word/numbering.xml")?.asText();
  if (!numberingXml) throw new Error("Clean copy is missing word/numbering.xml");
  const nextNumbering = graftScheduleNumbering(numberingXml);

  const out = new PizZip(fs.readFileSync(CLEAN_COPY));
  out.file("word/document.xml", documentXml);
  out.file("word/numbering.xml", nextNumbering);

  const bytes = out.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  fs.writeFileSync(OUTPUT, bytes);

  const tblCount = (documentXml.match(/<w:tbl\b/g) ?? []).length;
  const loopStarts = (documentXml.match(/\{#/g) ?? []).length;
  console.log(`Wrote ${OUTPUT}`);
  console.log(`document.xml tables=${tblCount} loop-starts=${loopStarts} bytes=${bytes.length}`);
}

main();
