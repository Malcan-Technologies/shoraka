#!/usr/bin/env tsx
/**
 * Rebuild `arf-contract-facility-lo.docx` from the 19 August 2026 clean copy:
 * rewrite placeholders to docxtemplater tags and graft branded headers/footers.
 *
 * Usage: pnpm --filter @cashsouk/api retag-lo-template
 */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";

const TEMPLATES_DIR = path.resolve(__dirname, "../src/modules/applications/templates");
const CLEAN_COPY = path.join(TEMPLATES_DIR, "01 LO (Clean Copy) 19 August 2026.docx");
const TAGGED_CURRENT = path.join(TEMPLATES_DIR, "arf-contract-facility-lo.docx");
const OUTPUT = TAGGED_CURRENT;

const AVOIDANCE =
  "For the avoidance of doubt, the obligations and liabilities of the Guarantors under this Letter of Offer shall be further set out in a Guarantee Agreement to be executed by the Guarantors in favour of Shoraka Suyula Platform Sdn. Bhd. (Reg. No : 202101033028 (1433328-H)). The Guarantors expressly acknowledge and agree that the execution of such Guarantee Agreement shall constitute a condition precedent to the disbursement of the Facility and that the detailed terms, covenants and undertakings therein shall prevail and be binding upon the Guarantors in addition to the provisions of this Letter of Offer.";

const BEING_INDIVIDUAL =
  "being the Guarantors in respect of the Facility by SHORAKA SUYULA PLATFORM SDN BHD (Reg. No : 202101033028 (1433328-H)) to {issuer_name} hereby agree to the terms and conditions stated in this Letter of Offer dated _______________.";

const BEING_CORPORATE =
  "We, {company_name} (Registration No. {company_ssm}) being the Guarantor in respect of the Facility by SHORAKA SUYULA PLATFORM SDN BHD (Reg. No : 202101033028 (1433328-H)) to {issuer_name} hereby agree to the terms and conditions stated in this Letter of Offer dated _______________.";

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
  const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = tRe.exec(pXml))) {
    text += decodeXml(match[1] ?? "");
  }
  return text;
}

function firstRunRpr(pXml: string): string {
  const run = pXml.match(/<w:r\b[\s\S]*?<\/w:r>/);
  if (!run) return `<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>`;
  const rPr = run[0].match(/<w:rPr\b[\s\S]*?<\/w:rPr>/);
  if (!rPr) return "";
  return rPr[0]
    .replace(/<w:highlight\b[^/]*\/>/g, "")
    .replace(/<w:highlight\b[\s\S]*?<\/w:highlight>/g, "");
}

function rewriteParagraphText(pXml: string, next: string): string {
  const open = pXml.match(/^<w:p\b[^>]*>/)?.[0] ?? "<w:p>";
  const pPr = pXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const rPr = firstRunRpr(pXml);
  const space = /^\s|\s$/.test(next) ? ' xml:space="preserve"' : "";
  return `${open}${pPr}<w:r>${rPr}<w:t${space}>${encodeXml(next)}</w:t></w:r></w:p>`;
}

function makePara(
  text: string,
  opts?: { center?: boolean; heading?: boolean }
): string {
  const jc = opts?.center || opts?.heading ? "center" : "both";
  const rPr = opts?.heading
    ? `<w:rPr><w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/><w:u w:val="single"/></w:rPr>`
    : `<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>`;
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return `<w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="${jc}"/>${rPr}</w:pPr><w:r>${rPr}<w:t${space}>${encodeXml(text)}</w:t></w:r></w:p>`;
}

function signatureBoxParas(nameTag: string): string {
  return [
    makePara(nameTag),
    makePara("______________________________"),
    makePara("NRIC :"),
    makePara("Designation :"),
  ].join("");
}

function corporateSignatoryTable(): string {
  const tcPr = `<w:tcPr><w:tcW w:w="4675" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>`;
  return [
    `<w:tbl>`,
    `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`,
    `<w:tblGrid><w:gridCol w:w="4513"/><w:gridCol w:w="4513"/></w:tblGrid>`,
    `<w:tr>`,
    `<w:tc>${tcPr}${makePara("{#signatory_rows}")}${signatureBoxParas("{left}")}</w:tc>`,
    `<w:tc>${tcPr}${makePara("{#show_right}")}${signatureBoxParas("{right}")}${makePara("{/show_right}")}${makePara("{/signatory_rows}")}</w:tc>`,
    `</w:tr>`,
    `</w:tbl>`,
  ].join("");
}

function acknowledgementXml(): string {
  const heading = makePara("ACKNOWLEDGEMENT AND CONSENT BY GUARANTORS", { heading: true });
  return [
    makePara("{#has_individual_guarantors}"),
    makePara("{#guarantors_individual}"),
    heading,
    makePara("We, the undersigned:- "),
    makePara("{name}"),
    makePara(BEING_INDIVIDUAL),
    makePara(AVOIDANCE),
    makePara("Date: ______________________"),
    makePara(""),
    ...[signatureBoxParas("{name}")],
    makePara("{@page_break}"),
    makePara("{/guarantors_individual}"),
    makePara("{/has_individual_guarantors}"),
    makePara("{#has_corporate_guarantor}"),
    makePara("{#corporate_guarantor_pages}"),
    makePara("{#is_first_page}"),
    heading,
    makePara(BEING_CORPORATE),
    makePara(AVOIDANCE),
    makePara("Date: ______________________"),
    makePara("{/is_first_page}"),
    makePara("For and on behalf of {company_name}"),
    makePara(""),
    corporateSignatoryTable(),
    makePara("{@page_break}"),
    makePara("{/corporate_guarantor_pages}"),
    makePara("{/has_corporate_guarantor}"),
    makePara(""),
  ].join("");
}

function tagCheckboxes(xml: string): string {
  let n = 0;
  return xml.replace(/<w:t\b([^>]*)>☐<\/w:t>/g, (full, attrs: string) => {
    n += 1;
    const tag = n === 1 ? "{part_a_checkbox}" : "{part_b_checkbox}";
    return `<w:t${attrs}>${tag}</w:t>`;
  });
}

function applyPlaceholderText(text: string, insertNameIndex: { n: number }): string {
  const trimmed = text.trim();
  if (trimmed === "[INSERT NAME] (NRIC No. [INSERT])") {
    insertNameIndex.n += 1;
    if (insertNameIndex.n === 1) return "{#guarantors_individual}";
    if (insertNameIndex.n === 2) return "{line}";
    if (insertNameIndex.n === 3) return "{/guarantors_individual}";
  }

  const replacements: Array<[string, string]> = [
    ["[INSERT ISSUER NAME]", "{issuer_name}"],
    ["[ISSUER REGISTRATION NUMBER]", "{issuer_registration_number}"],
    ["[ISSUER ADDRESS]", "{issuer_address}"],
    ["Attention :[Name]", "Attention :{attention_name}"],
    ["Issuer ID: [Insert]", "Issuer ID: {issuer_id}"],
    ["Our Reference: [Insert]", "Our Reference: {our_reference}"],
    ["Date: [Insert]", "Date: {letter_date}"],
    ["[Insert Issuer Name] (Company No. insert [insert])", "{issuer_name} (Company No. {issuer_registration_number})"],
    ["[insert authorised person name]", "{moa_authorised_signatory_names}"],
    ["[insert – up to RM5,000,000]", "{financing_limit_rm}"],
    [
      "Up to [insert – up to RM1,000,000] per invoice, and not exceeding",
      "Up to {sub_limit_per_invoice_rm} per invoice, and not exceeding",
    ],
    [
      "Up to [insert – up to RM1,000,000] per invoice, being up to",
      "Up to {part_b_financing_amount_rm} per invoice, being up to",
    ],
    ["[insert – up to 180]", "{max_invoice_tenure_days}"],
    ["Up to [insert] days", "Up to {tenure_days} days"],
    [
      "within seven (7) days from the date of this letter",
      "within {offer_validity_phrase} from the date of this letter",
    ],
    [
      "maximum of [●] days from the date of disbursement",
      "maximum of {payment_period_days} days from the date of disbursement",
    ],
    [
      "Period of up to [●] (●) days after",
      "Period of up to {grace_period_days} ({grace_period_days_words}) days after",
    ],
    [
      "within [●] (●) days’ from acceptance",
      "within {transaction_docs_days} ({transaction_docs_days_words}) days’ from acceptance",
    ],
    [
      "the contract dated [●] between [●] and the Issuer for the [●]",
      "the contract dated {assigned_contract_date} between {assigned_contract_counterparty} and the Issuer for the {assigned_contract_description}",
    ],
    ["DATED [●]", "DATED {letter_date}"],
    [
      "We, _____________________________ (Registration No.: ____________________ having a registered address at ______________________________________________________________________ hereby confirm our acceptance of the offer of the Financing Facility of RM__________________________",
      "We, {issuer_name} (Registration No.: {issuer_registration_number} having a registered address at {issuer_address} hereby confirm our acceptance of the offer of the Financing Facility of {financing_limit_rm}",
    ],
    ["[insert]", "{financing_limit_rm}"],
  ];

  let next = text;
  if (trimmed === "[Position]") next = "{attention_position}";
  for (const [from, to] of replacements) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

function flattenAndReplace(xml: string): string {
  const insertNameIndex = { n: 0 };
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (pXml) => {
    const text = paragraphPlainText(pXml);
    if (!text) return pXml;
    const next = applyPlaceholderText(text, insertNameIndex);
    if (next === text) return pXml;
    return rewriteParagraphText(pXml, next);
  });
}

function paragraphStartContaining(xml: string, needle: string): number {
  const idx = xml.indexOf(needle);
  if (idx < 0) throw new Error(`Could not find ${JSON.stringify(needle)} in document.xml`);
  const start = Math.max(xml.lastIndexOf("<w:p ", idx), xml.lastIndexOf("<w:p>", idx));
  if (start < 0) throw new Error(`Could not find paragraph start for ${JSON.stringify(needle)}`);
  return start;
}

function rebuildAcknowledgements(xml: string): string {
  const ackStart = paragraphStartContaining(xml, "ACKNOWLEDGEMENT AND CONSENT BY GUARANTORS");
  const annexStart = paragraphStartContaining(xml, "ANNEXURE : GENERAL TERMS AND CONDITIONS");
  if (annexStart <= ackStart) {
    throw new Error("ANNEXURE paragraph is not after the guarantor acknowledgement");
  }
  return xml.slice(0, ackStart) + acknowledgementXml() + xml.slice(annexStart);
}

function graftSectPr(xml: string): string {
  const from =
    '<w:headerReference w:type="default" r:id="rId12"/><w:footerReference w:type="default" r:id="rId13"/>';
  const to = [
    '<w:headerReference w:type="even" r:id="rId16"/>',
    '<w:headerReference w:type="default" r:id="rId12"/>',
    '<w:footerReference w:type="even" r:id="rId17"/>',
    '<w:footerReference w:type="default" r:id="rId13"/>',
    '<w:headerReference w:type="first" r:id="rId18"/>',
    '<w:footerReference w:type="first" r:id="rId19"/>',
  ].join("");
  if (!xml.includes(from)) {
    throw new Error("Clean copy sectPr header/footer references did not match expected markup");
  }
  return xml.replace(from, to);
}

function graftRels(rels: string): string {
  let next = rels
    .replace('Target="header1.xml"', 'Target="header2.xml"')
    .replace('Target="footer1.xml"', 'Target="footer2.xml"');
  const extras = [
    '<Relationship Id="rId16" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>',
    '<Relationship Id="rId17" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
    '<Relationship Id="rId18" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header3.xml"/>',
    '<Relationship Id="rId19" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer3.xml"/>',
  ].join("");
  if (!next.includes("</Relationships>")) {
    throw new Error("document.xml.rels is missing </Relationships>");
  }
  return next.replace("</Relationships>", `${extras}</Relationships>`);
}

function graftContentTypes(xml: string): string {
  let next = xml;
  if (!next.includes('Extension="png"')) {
    next = next.replace(
      'xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      'xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/>'
    );
  }
  const overrides = [
    ["/word/header2.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"],
    ["/word/header3.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"],
    ["/word/footer2.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"],
    ["/word/footer3.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"],
  ] as const;
  for (const [part, contentType] of overrides) {
    if (next.includes(`PartName="${part}"`)) continue;
    next = next.replace(
      "</Types>",
      `<Override PartName="${part}" ContentType="${contentType}"/></Types>`
    );
  }
  return next;
}

const BRANDED_PARTS = [
  "word/header1.xml",
  "word/header2.xml",
  "word/header3.xml",
  "word/footer1.xml",
  "word/footer2.xml",
  "word/footer3.xml",
  "word/media/image1.png",
  "word/_rels/header2.xml.rels",
] as const;

function leftoverPlaceholders(xml: string): string[] {
  const text = paragraphPlainText(`<w:p>${xml}</w:p>`) || xml.replace(/<[^>]+>/g, "");
  const found: string[] = [];
  for (const pat of ["[Insert]", "[INSERT", "[insert", "[●]", "[Name]", "[Position]", "[Issuer]", "[Guarantor", "[Authorised", "[NAME OF COMPANY]"]) {
    if (text.includes(pat) || xml.includes(pat)) found.push(pat);
  }
  return found;
}

function requiredTagsPresent(xml: string): string[] {
  const required = [
    "{issuer_id}",
    "{our_reference}",
    "{letter_date}",
    "{issuer_name}",
    "{issuer_registration_number}",
    "{issuer_address}",
    "{attention_name}",
    "{attention_position}",
    "{financing_limit_rm}",
    "{tenure_days}",
    "{payment_period_days}",
    "{grace_period_days}",
    "{grace_period_days_words}",
    "{transaction_docs_days}",
    "{transaction_docs_days_words}",
    "{offer_validity_phrase}",
    "{part_a_checkbox}",
    "{part_b_checkbox}",
    "{sub_limit_per_invoice_rm}",
    "{max_invoice_tenure_days}",
    "{part_b_financing_amount_rm}",
    "{assigned_contract_date}",
    "{assigned_contract_counterparty}",
    "{assigned_contract_description}",
    "{moa_authorised_signatory_names}",
    "{#guarantors_individual}",
    "{line}",
    "{/guarantors_individual}",
    "{#corporate_guarantor_pages}",
    "{#is_first_page}",
    "{company_name}",
    "{company_ssm}",
    "{#signatory_rows}",
    "{left}",
    "{right}",
    "{@page_break}",
  ];
  return required.filter((tag) => !xml.includes(tag));
}

function main(): void {
  if (!fs.existsSync(CLEAN_COPY)) {
    throw new Error(`Clean copy not found: ${CLEAN_COPY}`);
  }
  if (!fs.existsSync(TAGGED_CURRENT)) {
    throw new Error(`Current tagged file not found: ${TAGGED_CURRENT}`);
  }

  const cleanZip = new PizZip(fs.readFileSync(CLEAN_COPY));
  const taggedZip = new PizZip(fs.readFileSync(TAGGED_CURRENT));

  let documentXml = cleanZip.file("word/document.xml")?.asText();
  if (!documentXml) throw new Error("Clean copy is missing word/document.xml");

  documentXml = tagCheckboxes(documentXml);
  documentXml = flattenAndReplace(documentXml);
  documentXml = rebuildAcknowledgements(documentXml);
  documentXml = graftSectPr(documentXml);

  const missing = requiredTagsPresent(documentXml);
  if (missing.length > 0) {
    throw new Error(`Tagged document.xml is missing: ${missing.join(", ")}`);
  }
  if (documentXml.includes("RM{financing_limit_rm}")) {
    throw new Error("MoA still prefixes financing_limit_rm with a literal RM");
  }
  const leftovers = leftoverPlaceholders(documentXml);
  if (leftovers.length > 0) {
    throw new Error(`Leftover placeholders in document.xml: ${leftovers.join(", ")}`);
  }

  const rels = cleanZip.file("word/_rels/document.xml.rels")?.asText();
  if (!rels) throw new Error("Clean copy is missing word/_rels/document.xml.rels");
  const types = cleanZip.file("[Content_Types].xml")?.asText();
  if (!types) throw new Error("Clean copy is missing [Content_Types].xml");

  const out = new PizZip(fs.readFileSync(CLEAN_COPY));
  out.file("word/document.xml", documentXml);
  out.file("word/_rels/document.xml.rels", graftRels(rels));
  out.file("[Content_Types].xml", graftContentTypes(types));

  for (const part of BRANDED_PARTS) {
    const file = taggedZip.file(part);
    if (!file) throw new Error(`Tagged file is missing ${part}`);
    out.file(part, file.asUint8Array());
  }

  const bytes = out.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  fs.writeFileSync(OUTPUT, bytes);

  const tblCount = (documentXml.match(/<w:tbl\b/g) ?? []).length;
  const loopStarts = (documentXml.match(/\{#/g) ?? []).length;
  console.log(`Wrote ${OUTPUT}`);
  console.log(`document.xml tables=${tblCount} loop-starts=${loopStarts} bytes=${bytes.length}`);
}

main();
