#!/usr/bin/env tsx
/**
 * Rebuild `arf-facility-agreement.docx` from the 19 August 2026 clean Facility
 * Agreement: rewrite merge slots to yellow-highlighted docxtemplater tags and
 * replace the two hardcoded ISSUER signature blocks with a signer loop. The
 * original ISSUER heading, SIGNED BY line, and “for and on behalf of” lines
 * are kept (the execution brace drawing is removed). Each signatory sits beside one wet-ink witness (JSG two-column
 * table), with page breaks so ISSUER execution is not shared with Schedule 1.
 * Schedules 4 to 9 are copied unchanged from the clean copy (no merge tags).
 *
 * Usage: pnpm --filter @cashsouk/api retag-fa-template
 */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";

const TEMPLATES_DIR = path.resolve(__dirname, "../src/modules/applications/templates");
const CLEAN_COPY = path.join(TEMPLATES_DIR, "02 FA (Clean Copy) 19 August 2026.docx");
const OUTPUT = path.join(TEMPLATES_DIR, "arf-facility-agreement.docx");

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

/**
 * Word emits empty paragraphs as `<w:p .../>`. Searching only for `</w:p>` swallows the
 * next real paragraph, and rewrite then emits an extra closer inside the table cell.
 */
const WORD_PARAGRAPH_RE = /<w:p\b[^>]*\/>|<w:p\b[\s\S]*?<\/w:p>/g;

function mapWordParagraphs(xml: string, fn: (pXml: string) => string): string {
  return xml.replace(WORD_PARAGRAPH_RE, fn);
}

function rewriteParagraphText(pXml: string, next: string): string {
  const rawOpen = pXml.match(/^<w:p\b[^>]*\/?>/)?.[0] ?? "<w:p>";
  const open = rawOpen.replace(/\s*\/>$/, ">");
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
  opts?: {
    center?: boolean;
    heading?: boolean;
    bold?: boolean;
    underline?: boolean;
    pageBreakBefore?: boolean;
  }
): string {
  const jc = opts?.center || opts?.heading ? "center" : "both";
  const rPr = bodyRpr({
    bold: opts?.heading || opts?.bold,
    underline: opts?.heading || opts?.underline,
  });
  const pageBreak = opts?.pageBreakBefore ? "<w:pageBreakBefore/>" : "";
  return `<w:p><w:pPr>${pageBreak}<w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="${jc}"/>${rPr}</w:pPr>${runsFromTemplatedText(text, rPr)}</w:p>`;
}

function emptyParas(count: number): string {
  return Array.from({ length: count }, () => makePara("")).join("");
}

function pageBreakPara(): string {
  return `<w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>`;
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

/** One CA signatory on the left, one wet-ink witness on the right. Blank rows leave room for the stamp. */
function issuerSignatoryTable(): string {
  const line = "______________________________";
  return twoColTable([
    [emptyParas(2), emptyParas(2)],
    [makePara(line), makePara(line)],
    [makePara("Name : {name}"), makePara("Name of Witness:")],
    [makePara("Designation : {designation}"), makePara("NRIC:")],
    [makePara("Date :"), makePara("Date :")],
    [makePara("Issuer's company stamp:"), makePara("")],
  ]);
}

function issuerSignatoriesXml(): string {
  return [
    makePara("{issuer_name}"),
    makePara("In the presence of:"),
    makePara("{#issuer_signatories}"),
    issuerSignatoryTable(),
    emptyParas(1),
    makePara("{/issuer_signatories}"),
    pageBreakPara(),
  ].join("");
}

function withPageBreakBefore(pXml: string): string {
  if (pXml.includes("<w:pageBreakBefore")) return pXml;
  if (pXml.includes("<w:pPr>")) return pXml.replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>");
  return pXml.replace(/^<w:p([^>]*)>/, `<w:p$1><w:pPr><w:pageBreakBefore/></w:pPr>`);
}

function stripFloatingDrawings(xml: string): string {
  return xml
    .replace(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g, "")
    .replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/g, "")
    .replace(/<w:pict\b[\s\S]*?<\/w:pict>/g, "");
}

type WalkState = {
  region: "preamble" | "schedule1" | "schedule2";
  pendingBullet: string | null;
};

function tagIssuerPartyLine(text: string, includeEmail: boolean): string {
  let next = text.replace("[ISSUER]", "{issuer_name}");
  next = next.replace("(Company No. [insert])", "(Company No. {issuer_registration_number})");
  next = next.replace(
    "principal place of business at [insert]",
    "principal place of business at {issuer_address}"
  );
  if (includeEmail) {
    next = next.replace(
      "electronic mail address at [insert]",
      "electronic mail address at {issuer_email}"
    );
  }
  return next;
}

function transformParagraph(pXml: string, state: WalkState): string {
  const text = paragraphPlainText(pXml);
  const compact = compactParagraphText(text);

  if (compact === "SCHEDULE 1") {
    state.region = "schedule1";
    state.pendingBullet = null;
    return pXml;
  }
  if (compact === "SCHEDULE 2") {
    state.region = "schedule2";
    state.pendingBullet = null;
    return pXml;
  }
  if (compact.startsWith("SCHEDULE 3")) {
    state.region = "preamble";
    state.pendingBullet = null;
    return pXml;
  }
  if (compact.startsWith("SCHEDULE 4")) {
    throw new Error("SCHEDULE 4 reached rewriteBodyParagraphs; split the clean copy first");
  }

  if (state.pendingBullet) {
    const replacement = state.pendingBullet;
    if (compact === "[●]" || compact === "[●") {
      state.pendingBullet = null;
      return rewriteParagraphText(pXml, replacement);
    }
  }

  if (/^THIS AGREEMENT is made on the\s*day of\s*20/i.test(compact)) {
    return rewriteParagraphText(pXml, "THIS AGREEMENT is made on {facility_agreement_date}");
  }

  if (compact.includes("[ISSUER]") && compact.includes("Company No.")) {
    return rewriteParagraphText(
      pXml,
      tagIssuerPartyLine(text, compact.includes("electronic mail address"))
    );
  }

  if (compact.includes("e-mail to [XXX]") || compact.includes("email to [XXX]")) {
    return rewriteParagraphText(pXml, text.replace("[XXX]", "{trustee_disclosure_email}"));
  }

  if (compact.includes("[insert percentage]")) {
    return rewriteParagraphText(
      pXml,
      text.replace("[insert percentage]", "{facility_fee_rate_percent}")
    );
  }

  if (state.region === "schedule1") {
    if (compact === "Issuer") {
      state.pendingBullet =
        "{issuer_name} (Company No. {issuer_registration_number}) of {issuer_address}";
      return pXml;
    }
    if (compact === "Guarantor(s)") {
      state.pendingBullet = "{#guarantors_individual}{line}{/guarantors_individual}";
      return pXml;
    }
    if (compact.startsWith("Corporate Guarantor")) {
      state.pendingBullet = "{#guarantors_corporate}{company_line}{/guarantors_corporate}";
      return pXml;
    }
    if (compact.includes("[●]")) {
      if (compact.includes("Issuer")) {
        return rewriteParagraphText(
          pXml,
          text.replace(
            "[●]",
            "{issuer_name} (Company No. {issuer_registration_number}) of {issuer_address}"
          )
        );
      }
      if (compact.includes("Guarantor(s)")) {
        return rewriteParagraphText(
          pXml,
          text.replace("[●]", "{#guarantors_individual}{line}{/guarantors_individual}")
        );
      }
      if (compact.includes("Corporate Guarantor")) {
        return rewriteParagraphText(
          pXml,
          text.replace("[●]", "{#guarantors_corporate}{company_line}{/guarantors_corporate}")
        );
      }
    }
  }

  if (state.region === "schedule2") {
    if (compact.includes("Approved Financing Limit:") && compact.includes("[●]")) {
      return rewriteParagraphText(
        pXml,
        text.replace(
          "Approved Financing Limit: [●]",
          "Approved Financing Limit: {financing_limit_rm}"
        )
      );
    }
    if (compact.includes("shall not exceed [●]")) {
      return rewriteParagraphText(
        pXml,
        text.replace("shall not exceed [●]", "shall not exceed {sub_limit_per_invoice_rm}")
      );
    }
    if (compact === "Drawdown Fee") {
      state.pendingBullet = "{drawdown_fee}";
      return pXml;
    }
    if (compact === "Bank Name") {
      state.pendingBullet = "{issuer_bank_name}";
      return pXml;
    }
    if (compact === "Bank Branch") {
      state.pendingBullet = "";
      return pXml;
    }
    if (compact === "Account Name") {
      state.pendingBullet = "{issuer_bank_account_name}";
      return pXml;
    }
    if (compact === "SWIFT Code") {
      state.pendingBullet = "{issuer_bank_swift}";
      return pXml;
    }
    if (compact === "[●]" || compact === "[●") {
      const fallback = state.pendingBullet ?? "{drawdown_fee}";
      state.pendingBullet = null;
      return rewriteParagraphText(pXml, fallback);
    }
  }

  return pXml;
}

function rewriteBodyParagraphs(xml: string): string {
  const state: WalkState = {
    region: "preamble",
    pendingBullet: null,
  };
  return mapWordParagraphs(xml, (pXml) => transformParagraph(pXml, state));
}

function insertAccountNumberBankRow(xml: string): string {
  const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  let inserted = false;
  const next = xml.replace(rowRe, (row) => {
    const cells = [...row.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cell) =>
      compactParagraphText(paragraphPlainText(cell[0]))
    );
    if (cells[1] !== "Account Name") return row;
    if (inserted) return row;
    inserted = true;
    const cloned = row
      .replace(">Account Name</w:t>", ">Account Number</w:t>")
      .replaceAll("{issuer_bank_account_name}", "{issuer_bank_account_number}");
    return cloned + row;
  });
  if (!inserted) {
    throw new Error("Could not insert Account Number row before Account Name");
  }
  return next;
}

function rebuildIssuerExecution(xml: string): string {
  const matches = [...xml.matchAll(WORD_PARAGRAPH_RE)];
  let issuerMatch: RegExpMatchArray | null = null;
  let behalfMatch: RegExpMatchArray | null = null;
  let scheduleMatch: RegExpMatchArray | null = null;
  let seenWitness = false;
  let seenAgent = false;

  for (const match of matches) {
    const compact = compactParagraphText(paragraphPlainText(match[0]));
    if (compact.startsWith("IN WITNESS WHEREOF the parties hereto have caused this Agreement")) {
      seenWitness = true;
    }
    if (seenWitness && compact === "AGENT") seenAgent = true;
    if (seenAgent && compact === "ISSUER" && !issuerMatch) issuerMatch = match;
    if (issuerMatch && !behalfMatch && compact === "for and on behalf of") {
      behalfMatch = match;
    }
    if (seenWitness && compact === "SCHEDULE 1") {
      scheduleMatch = match;
      break;
    }
  }

  if (!issuerMatch || issuerMatch.index == null) {
    throw new Error("Could not find main ISSUER execution heading");
  }
  if (!behalfMatch || behalfMatch.index == null) {
    throw new Error("Could not find ISSUER 'for and on behalf of' line");
  }
  if (!scheduleMatch || scheduleMatch.index == null) {
    throw new Error("Could not find SCHEDULE 1 after the ISSUER execution block");
  }

  const headingEnd = behalfMatch.index + behalfMatch[0].length;
  const headingXml = stripFloatingDrawings(
    withPageBreakBefore(xml.slice(issuerMatch.index, headingEnd))
  );
  return xml.slice(0, issuerMatch.index) + headingXml + issuerSignatoriesXml() + xml.slice(scheduleMatch.index);
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

function requiredTagsPresent(xml: string): string[] {
  const required = [
    "{facility_agreement_date}",
    "{issuer_name}",
    "{issuer_registration_number}",
    "{issuer_address}",
    "{issuer_email}",
    "{financing_limit_rm}",
    "{sub_limit_per_invoice_rm}",
    "{facility_fee_rate_percent}",
    "{drawdown_fee}",
    "{trustee_disclosure_email}",
    "{issuer_bank_name}",
    "{issuer_bank_account_number}",
    "{issuer_bank_account_name}",
    "{issuer_bank_swift}",
    "{#guarantors_individual}",
    "{line}",
    "{/guarantors_individual}",
    "{#guarantors_corporate}",
    "{company_line}",
    "{/guarantors_corporate}",
    "{#issuer_signatories}",
    "{name}",
    "{designation}",
    "{/issuer_signatories}",
  ];
  return required.filter((tag) => !xml.includes(tag));
}

function assertDocumentXmlWellFormed(xml: string): void {
  const tokenRe = /<(\/?)([A-Za-z0-9:_-]+)([^>]*?)(\/?)\s*>/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(xml))) {
    const [, closing, name, attrs, empty] = match;
    if (!name || name.startsWith("?") || name.startsWith("!")) continue;
    if (empty === "/" || (attrs ?? "").trimEnd().endsWith("/")) continue;
    if (closing === "/") {
      const expected = stack.pop();
      if (expected !== name) {
        throw new Error(
          `Tagged document.xml is not well-formed: closing ${name} expected ${expected ?? "none"} at ${match.index}`
        );
      }
      continue;
    }
    stack.push(name);
  }
  if (stack.length > 0) {
    throw new Error(`Tagged document.xml is not well-formed: unclosed ${stack.slice(-5).join(", ")}`);
  }
}

function leftoverPlaceholders(xml: string): string[] {
  const text = xml.replace(/<[^>]+>/g, "");
  const found: string[] = [];
  for (const pat of [
    "[ISSUER]",
    "[ISSUER NAME]",
    "[insert percentage]",
    "[XXX]",
    "[Issuer's Address]",
    "[Issuer’s Address]",
    "[●]",
    "[●",
  ]) {
    if (text.includes(pat)) found.push(pat);
  }
  if (text.includes("[insert]")) found.push("[insert]");
  return found;
}

function splitAtSchedule4(xml: string): { before: string; fromSchedule4: string } {
  const matches = [...xml.matchAll(WORD_PARAGRAPH_RE)];
  for (const match of matches) {
    const compact = compactParagraphText(paragraphPlainText(match[0]));
    if (compact.startsWith("SCHEDULE 4") && match.index != null) {
      return {
        before: xml.slice(0, match.index),
        fromSchedule4: xml.slice(match.index),
      };
    }
  }
  throw new Error("Could not find SCHEDULE 4 heading");
}

function mergeTagsInXml(xml: string): string[] {
  const text = xml.replace(/<[^>]+>/g, "");
  return [...new Set(text.match(/\{[#/]?[A-Za-z][A-Za-z0-9_]*\}/g) ?? [])];
}

function main(): void {
  if (!fs.existsSync(CLEAN_COPY)) {
    throw new Error(`Clean copy not found: ${CLEAN_COPY}`);
  }

  const cleanZip = new PizZip(fs.readFileSync(CLEAN_COPY));
  const cleanXml = cleanZip.file("word/document.xml")?.asText();
  if (!cleanXml) throw new Error("Clean copy is missing word/document.xml");

  const { before, fromSchedule4 } = splitAtSchedule4(cleanXml);
  if (!fromSchedule4.includes("SCHEDULE 9")) {
    throw new Error("Clean copy slice after SCHEDULE 4 is missing SCHEDULE 9");
  }

  let taggedHead = stripYellowHighlights(before);
  taggedHead = rewriteBodyParagraphs(taggedHead);
  taggedHead = insertAccountNumberBankRow(taggedHead);
  taggedHead = rebuildIssuerExecution(taggedHead);
  taggedHead = ensureYellowOnValueTagRuns(taggedHead);

  const missing = requiredTagsPresent(taggedHead);
  if (missing.length > 0) {
    throw new Error(`Tagged document.xml is missing: ${missing.join(", ")}`);
  }
  if (!taggedHead.includes('w:val="yellow"')) {
    throw new Error("Tagged document has no yellow highlighting on merge tags");
  }
  const unhighlighted = valueTagsMissingHighlight(taggedHead);
  if (unhighlighted.length > 0) {
    throw new Error(`Value merge tags missing yellow highlight: ${unhighlighted.join(", ")}`);
  }
  const leftovers = leftoverPlaceholders(taggedHead);
  if (leftovers.length > 0) {
    throw new Error(`Leftover placeholders before SCHEDULE 4: ${leftovers.join(", ")}`);
  }
  const scheduleTags = mergeTagsInXml(fromSchedule4);
  if (scheduleTags.length > 0) {
    throw new Error(`Schedules 4–9 must stay untagged: ${scheduleTags.join(", ")}`);
  }
  if (!taggedHead.includes("INVESTOR") || !taggedHead.includes("AGENT")) {
    throw new Error("Investor/Agent execution blocks were removed");
  }

  const documentXml = taggedHead + fromSchedule4;
  assertDocumentXmlWellFormed(documentXml);

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
