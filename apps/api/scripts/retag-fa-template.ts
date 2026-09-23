#!/usr/bin/env tsx
/**
 * Rebuild `arf-facility-agreement.docx` from the 19 August 2026 clean Facility
 * Agreement: rewrite merge slots to docxtemplater tags and
 * replace the two hardcoded ISSUER signature blocks with a signer loop. Investor
 * and Agent keep the clean-copy hanging layout (SIGNED BY, company lines, tabbed
 * signature strokes); only Name/Designation merge tags are inserted after the
 * colons. Signature strokes stay as the clean-copy underscore runs — one line,
 * no extra border or Courier restyling. Name/Designation/Date are pinned to the
 * right column so wrapped values cannot jump to the left margin.
 * The original ISSUER heading, SIGNED BY line, and “for and on behalf of”
 * lines are kept (the execution brace drawing is removed). Each issuer signatory
 * sits beside one wet-ink witness (JSG two-column table). At most two
 * signatory/witness pairs share a page, with extra vertical space for signatures.
 * Each issuer table column shares one colon tab (longest label in that column)
 * so wrapped values line up. One “Issuer's company stamp:” line follows the last
 * signatory (after the signatory-pages loop). A page break then keeps ISSUER
 * execution off Schedule 1.
 * Schedules 4 to 8 stay unchanged. Schedule 9 Appendix 1 fills the Facility
 * Agreement date and issuer particulars; remaining schedule placeholders stay.
 *
 * Usage: pnpm --filter @cashsouk/api retag-fa-template
 */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import {
  FA_EXECUTION_COLON_TWIPS,
  FA_EXECUTION_LABEL_LEFT_TWIPS,
  FA_EXECUTION_STROKE_FIRST_LINE_TWIPS,
  FA_EXECUTION_STROKE_LEFT_TWIPS,
  FA_ISSUER_SIGNATORY_COLON_TWIPS,
  FA_ISSUER_WITNESS_COLON_TWIPS,
  hangingValueIndentXml,
} from "../src/modules/generated-documents/hanging-execution-label";
import {
  assertNoDocxHighlights,
  stripHighlightsFromDocx,
  stripHighlightsFromDocxXml,
} from "../src/modules/generated-documents/docx-highlights";

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
  const re = /\{[A-Za-z][A-Za-z0-9_]*\}/g;
  const runs: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      runs.push(textRun(text.slice(last, match.index), plain));
    }
    runs.push(textRun(match[0], plain));
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
    align?: "both" | "left";
  }
): string {
  const jc = opts?.center || opts?.heading ? "center" : opts?.align === "left" ? "left" : "both";
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

/** Clean-copy ISSUER / witness strokes: default Arial underscores, no second rule. */
const ISSUER_SIGNATURE_STROKE = "________________________";
const WITNESS_SIGNATURE_STROKE = "______________________";

function signatureStrokePara(stroke: string): string {
  return `<w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:r><w:t>${stroke}</w:t></w:r></w:p>`;
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

/** One CA signatory on the left, one wet-ink witness on the right. */
function issuerSignatoryTable(): string {
  return twoColTable([
    [emptyParas(3), emptyParas(3)],
    [signatureStrokePara(ISSUER_SIGNATURE_STROKE), signatureStrokePara(WITNESS_SIGNATURE_STROKE)],
    [tableHangingLabelParagraph("Name", "name", FA_ISSUER_SIGNATORY_COLON_TWIPS), tableHangingLabelParagraph("Name of Witness", "witness_name", FA_ISSUER_WITNESS_COLON_TWIPS)],
    [tableHangingLabelParagraph("Designation", "designation", FA_ISSUER_SIGNATORY_COLON_TWIPS), tableHangingLabelParagraph("NRIC", "witness_nric", FA_ISSUER_WITNESS_COLON_TWIPS)],
    [tableHangingLabelParagraph("Date", undefined, FA_ISSUER_SIGNATORY_COLON_TWIPS), tableHangingLabelParagraph("Date", undefined, FA_ISSUER_WITNESS_COLON_TWIPS)],
    [emptyParas(2), emptyParas(2)],
  ]);
}

function issuerCompanyStampBlock(): string {
  return twoColTable([
    [makePara("Issuer's company stamp:"), makePara("")],
    [emptyParas(4), emptyParas(4)],
  ]);
}

function issuerSignatoriesXml(): string {
  return [
    makePara("{issuer_name}"),
    makePara("In the presence of:"),
    makePara("{#issuer_signatory_pages}"),
    makePara("{#issuer_signatories}"),
    issuerSignatoryTable(),
    emptyParas(3),
    makePara("{/issuer_signatories}"),
    makePara("{@page_break}"),
    makePara("{/issuer_signatory_pages}"),
    issuerCompanyStampBlock(),
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
    if (
      compact.includes("With below Sub-Limits") ||
      compact.includes("shall not exceed [●]") ||
      compact.includes("Sub-Limits for each facility")
    ) {
      return "";
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

function hangingLabelParagraph(
  label: string,
  tag?: string,
  colonPosTwips: number = FA_EXECUTION_COLON_TWIPS,
  labelLeftTwips: number = FA_EXECUTION_LABEL_LEFT_TWIPS
): string {
  const rPr = bodyRpr();
  const runs = [textRun(label, rPr), `<w:r>${rPr}<w:tab/></w:r>`, textRun(":", rPr)];
  if (tag) {
    runs.push(textRun(" ", rPr));
    runs.push(textRun(`{${tag}}`, rPr));
  }
  return `<w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/>${hangingValueIndentXml(colonPosTwips, labelLeftTwips)}${rPr}</w:pPr>${runs.join("")}</w:p>`;
}

function tableHangingLabelParagraph(
  label: string,
  tag?: string,
  colonPosTwips: number = FA_ISSUER_SIGNATORY_COLON_TWIPS
): string {
  return hangingLabelParagraph(label, tag, colonPosTwips, 0);
}

function executionLabelParagraph(label: "Name" | "Designation" | "Date", tag?: string): string {
  return hangingLabelParagraph(label, tag);
}

function isUnderscoreStrokeParagraph(pXml: string): boolean {
  return /^_{8,}$/.test(compactParagraphText(paragraphPlainText(pXml)).replace(/\s/g, ""));
}

function pinExecutionStrokeIndent(pXml: string): string {
  const indent = `<w:ind w:left="${FA_EXECUTION_STROKE_LEFT_TWIPS}" w:firstLine="${FA_EXECUTION_STROKE_FIRST_LINE_TWIPS}"/>`;
  if (/<w:ind\b[^/]*\/>/.test(pXml)) return pXml.replace(/<w:ind\b[^/]*\/>/, indent);
  if (pXml.includes("<w:pPr>")) return pXml.replace("<w:pPr>", `<w:pPr>${indent}`);
  return pXml.replace(/^<w:p([^>]*)>/, `<w:p$1><w:pPr>${indent}</w:pPr>`);
}

/** Same brace origin and width as Investor so Agent fields sit the same distance from `{`. */
function alignAgentBraceToInvestor(pXml: string): string {
  return pXml
    .replace(/relativeFrom="column"/g, 'relativeFrom="margin"')
    .replace(/<wp:posOffset>3019425<\/wp:posOffset>/g, "<wp:posOffset>2895600</wp:posOffset>")
    .replace(/cx="457200"/g, 'cx="304800"')
    .replace(/margin-left:237\.75pt/g, "margin-left:228pt")
    .replace(/width:36pt/g, "width:24pt")
    .replace(/mso-position-horizontal-relative:text/g, "mso-position-horizontal-relative:margin");
}

function polishInvestorAgentParagraph(pXml: string): string {
  const compact = compactParagraphText(paragraphPlainText(pXml));
  if (/^name:?$/i.test(compact) || /^designation:?$/i.test(compact) || /^date:?$/i.test(compact)) {
    const label = /^name/i.test(compact) ? "Name" : /^designation/i.test(compact) ? "Designation" : "Date";
    return executionLabelParagraph(label);
  }
  if (isUnderscoreStrokeParagraph(pXml)) return pinExecutionStrokeIndent(pXml);
  return pXml;
}

/** Keep the clean-copy hanging Investor/Agent layout; only fill Name and Designation. */
function tagInvestorAgentExecution(xml: string): string {
  const state = {
    seenWitness: false,
    phase: "pre" as "pre" | "investor" | "agent" | "done",
    nameIndex: 0,
    designationIndex: 0,
    investorNames: 0,
    investorDesignations: 0,
    agentNames: 0,
    agentDesignations: 0,
  };
  const next = mapWordParagraphs(xml, (pXml) => {
    const compact = compactParagraphText(paragraphPlainText(pXml));
    if (compact.startsWith("IN WITNESS WHEREOF the parties hereto have caused this Agreement")) {
      state.seenWitness = true;
      return pXml;
    }
    if (!state.seenWitness || state.phase === "done") return pXml;
    if (compact === "INVESTOR" && state.phase === "pre") {
      state.phase = "investor";
      return pXml;
    }
    if (compact === "AGENT" && state.phase === "investor") {
      state.investorNames = state.nameIndex;
      state.investorDesignations = state.designationIndex;
      state.phase = "agent";
      state.nameIndex = 0;
      state.designationIndex = 0;
      return alignAgentBraceToInvestor(pXml);
    }
    if (compact === "ISSUER" && (state.phase === "agent" || state.phase === "investor")) {
      if (state.phase === "agent") {
        state.agentNames = state.nameIndex;
        state.agentDesignations = state.designationIndex;
      }
      state.phase = "done";
      return pXml;
    }
    if (state.phase !== "investor" && state.phase !== "agent") return pXml;
    const prefix = state.phase === "investor" ? "investor" : "agent";
    if (/^name:?$/i.test(compact)) {
      state.nameIndex += 1;
      if (state.nameIndex > 2) {
        throw new Error(`${prefix} execution has more than 2 Name lines`);
      }
      return executionLabelParagraph("Name", `${prefix}_${state.nameIndex}_name`);
    }
    if (/^designation:?$/i.test(compact)) {
      state.designationIndex += 1;
      if (state.designationIndex > 2) {
        throw new Error(`${prefix} execution has more than 2 Designation lines`);
      }
      return executionLabelParagraph(
        "Designation",
        `${prefix}_${state.designationIndex}_designation`
      );
    }
    return polishInvestorAgentParagraph(pXml);
  });
  if (state.phase !== "done") {
    throw new Error("Could not find Investor/Agent execution headings before ISSUER");
  }
  if (state.investorNames !== 2 || state.investorDesignations !== 2) {
    throw new Error(
      `Investor execution needs 2 Name and 2 Designation lines, found ${state.investorNames}/${state.investorDesignations}`
    );
  }
  if (state.agentNames !== 2 || state.agentDesignations !== 2) {
    throw new Error(
      `Agent execution needs 2 Name and 2 Designation lines, found ${state.agentNames}/${state.agentDesignations}`
    );
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

function requiredTagsPresent(xml: string): string[] {
  const required = [
    "{facility_agreement_date}",
    "{issuer_name}",
    "{issuer_registration_number}",
    "{issuer_address}",
    "{issuer_email}",
    "{financing_limit_rm}",
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
    "{#issuer_signatory_pages}",
    "{#issuer_signatories}",
    "{name}",
    "{designation}",
    "{witness_name}",
    "{witness_nric}",
    "{/issuer_signatories}",
    "{@page_break}",
    "{/issuer_signatory_pages}",
    "{investor_1_name}",
    "{investor_1_designation}",
    "{investor_2_name}",
    "{investor_2_designation}",
    "{agent_1_name}",
    "{agent_1_designation}",
    "{agent_2_name}",
    "{agent_2_designation}",
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

const APPENDIX1_ISSUER_PARTICULARS =
  "{issuer_name} (Company No. {issuer_registration_number}) of {issuer_address}";

const APPENDIX1_ALLOWED_TAGS = [
  "{facility_agreement_date}",
  "{issuer_name}",
  "{issuer_registration_number}",
  "{issuer_address}",
] as const;

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

function tagAppendix1Particulars(xml: string): string {
  const tables = findTables(xml);
  for (const table of tables) {
    const tbl = xml.slice(table.start, table.end);
    if (!tbl.includes("DAY AND YEAR OF THE FACILITY AGREEMENT")) continue;
    if (!tbl.includes("NAME AND PARTICULAR OF THE ISSUER")) continue;

    const nextTbl = tbl.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
      const itemText = compactParagraphText(paragraphPlainText(row));
      let fill: string | null = null;
      if (itemText.includes("DAY AND YEAR OF THE FACILITY AGREEMENT")) {
        fill = "{facility_agreement_date}";
      } else if (itemText.includes("NAME AND PARTICULAR OF THE ISSUER")) {
        fill = APPENDIX1_ISSUER_PARTICULARS;
      }
      if (!fill) return row;

      const cells = [...row.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)];
      const last = cells[cells.length - 1];
      if (!last || last.index == null) {
        throw new Error("Appendix 1 row is missing a Particulars cell");
      }
      const particulars = last[0];
      const existing = compactParagraphText(paragraphPlainText(particulars));
      if (existing) {
        throw new Error(`Appendix 1 particulars cell was not empty: ${JSON.stringify(existing)}`);
      }
      let replaced = false;
      const tagged = particulars.replace(WORD_PARAGRAPH_RE, (pXml) => {
        if (replaced) return pXml;
        replaced = true;
        return rewriteParagraphText(pXml, fill!);
      });
      if (!replaced) {
        throw new Error("Appendix 1 particulars cell has no paragraph to tag");
      }
      return row.slice(0, last.index) + tagged + row.slice(last.index + particulars.length);
    });

    if (
      !nextTbl.includes("{facility_agreement_date}") ||
      !nextTbl.includes("{issuer_registration_number}")
    ) {
      throw new Error("Appendix 1 date and issuer particulars were not tagged");
    }
    return xml.slice(0, table.start) + nextTbl + xml.slice(table.end);
  }
  throw new Error("Could not find Appendix 1 particulars table");
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

  const { before, fromSchedule4: scheduleSlice } = splitAtSchedule4(cleanXml);
  if (!scheduleSlice.includes("SCHEDULE 9")) {
    throw new Error("Clean copy slice after SCHEDULE 4 is missing SCHEDULE 9");
  }

  let fromSchedule4 = tagAppendix1Particulars(scheduleSlice);
  fromSchedule4 = stripHighlightsFromDocxXml(fromSchedule4);

  let taggedHead = stripHighlightsFromDocxXml(before);
  taggedHead = rewriteBodyParagraphs(taggedHead);
  taggedHead = insertAccountNumberBankRow(taggedHead);
  taggedHead = tagInvestorAgentExecution(taggedHead);
  taggedHead = rebuildIssuerExecution(taggedHead);
  taggedHead = stripHighlightsFromDocxXml(taggedHead);

  const missing = requiredTagsPresent(taggedHead);
  if (missing.length > 0) {
    throw new Error(`Tagged document.xml is missing: ${missing.join(", ")}`);
  }
  if (
    taggedHead.includes("{sub_limit_per_invoice_rm}") ||
    taggedHead.includes("With below Sub-Limits") ||
    taggedHead.includes("Sub-Limits for each facility")
  ) {
    throw new Error("Invoice sub-limit sentence or merge tag is still in the Facility Agreement");
  }
  assertNoDocxHighlights(taggedHead + fromSchedule4);
  const leftovers = leftoverPlaceholders(taggedHead);
  if (leftovers.length > 0) {
    throw new Error(`Leftover placeholders before SCHEDULE 4: ${leftovers.join(", ")}`);
  }
  const scheduleTags = mergeTagsInXml(fromSchedule4);
  const unexpectedScheduleTags = scheduleTags.filter(
    (tag) => !(APPENDIX1_ALLOWED_TAGS as readonly string[]).includes(tag)
  );
  if (unexpectedScheduleTags.length > 0) {
    throw new Error(`Schedules 4–9 have unexpected merge tags: ${unexpectedScheduleTags.join(", ")}`);
  }
  for (const tag of APPENDIX1_ALLOWED_TAGS) {
    if (!fromSchedule4.includes(tag)) {
      throw new Error(`Appendix 1 is missing ${tag}`);
    }
  }
  if (!taggedHead.includes("INVESTOR") || !taggedHead.includes("AGENT")) {
    throw new Error("Investor/Agent execution blocks were removed");
  }
  if (!taggedHead.includes("SIGNED BY authorised representatives of")) {
    throw new Error("Investor hanging execution text was removed");
  }
  if (!taggedHead.includes("Investor Agreement signed with")) {
    throw new Error("Investor hanging execution text was removed");
  }
  const stampMatches = taggedHead.match(/Issuer's company stamp:/g) ?? [];
  if (stampMatches.length !== 1) {
    throw new Error(`Expected one Issuer's company stamp line, found ${stampMatches.length}`);
  }
  const stampAt = taggedHead.indexOf("Issuer's company stamp:");
  const pagesLoopEnd = taggedHead.indexOf("{/issuer_signatory_pages}");
  if (pagesLoopEnd < 0 || stampAt < pagesLoopEnd) {
    throw new Error("Issuer's company stamp must sit after the last signatory page");
  }

  const documentXml = taggedHead + fromSchedule4;
  assertDocumentXmlWellFormed(documentXml);

  const out = new PizZip(fs.readFileSync(CLEAN_COPY));
  out.file("word/document.xml", documentXml);

  const bytes = stripHighlightsFromDocx(
    out.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer
  );
  fs.writeFileSync(OUTPUT, bytes);

  const tblCount = (documentXml.match(/<w:tbl\b/g) ?? []).length;
  const loopStarts = (documentXml.match(/\{#/g) ?? []).length;
  console.log(`Wrote ${OUTPUT}`);
  console.log(`document.xml tables=${tblCount} loop-starts=${loopStarts} bytes=${bytes.length}`);
}

main();
