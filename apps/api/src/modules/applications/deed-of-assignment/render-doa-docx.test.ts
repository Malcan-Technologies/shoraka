import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { createDeedOfAssignmentFixture } from "./doa-fixture";
import type { DeedOfAssignmentMergeData } from "./doa-merge.types";
import {
  readDeedOfAssignmentTemplateBytes,
  renderDeedOfAssignmentDocx,
  resolveDeedOfAssignmentTemplatePath,
} from "./render-doa-docx";

const SCHEDULE3_NIL_NOTE =
  "Nil as at the date of execution; to be supplemented from time to time in accordance with Clause 4.4.";

function renderedXml(data: DeedOfAssignmentMergeData): string {
  const zip = new PizZip(renderDeedOfAssignmentDocx(data));
  return zip.file("word/document.xml")?.asText() ?? "";
}

function runContaining(xml: string, needle: string): string | null {
  const runRe = /<w:r\b[\s\S]*?<\/w:r>/g;
  let match: RegExpExecArray | null;
  while ((match = runRe.exec(xml))) {
    const texts = [...match[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) =>
      (m[1] ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    );
    if (texts.join("").includes(needle)) return match[0];
  }
  return null;
}

function wordPlainText(xml: string): string {
  let text = "";
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    text += (match[1] ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return text;
}

function resolveNoticeOfAssignmentTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "..", "templates", "arf-notice-of-assignment-template.docx"),
    path.join(
      process.cwd(),
      "src/modules/applications/templates",
      "arf-notice-of-assignment-template.docx"
    ),
    path.join(
      process.cwd(),
      "apps/api/src/modules/applications/templates",
      "arf-notice-of-assignment-template.docx"
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Notice of Assignment template not found. Looked in: ${candidates.join(", ")}`
  );
}

describe("renderDeedOfAssignmentDocx", () => {
  it("resolves the tagged template file", () => {
    expect(resolveDeedOfAssignmentTemplatePath()).toMatch(/arf-deed-of-assignment\.docx$/);
  });

  it("keeps yellow value tags, wet-ink execution, and unmerged schedules", () => {
    const zip = new PizZip(readDeedOfAssignmentTemplateBytes());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const plain = wordPlainText(xml);

    expect(plain).toContain("is made on {assignment_date}");
    expect(plain).toContain("{assignor_company_name}");
    expect(plain).toContain("{trust_swift_code}");
    expect(plain).toContain("{#assignor_signatories}");
    expect(plain).toContain("{/assignor_signatories}");
    expect(plain).toContain("Name: {name}");
    expect(plain).toContain("In the presence of:");
    expect(plain).toContain("[Witness]");
    expect(plain).not.toContain("ELECTRONIC SIGNATURES — ASSIGNOR");
    expect(plain).not.toContain("{assignor_signatory_1_name}");
    expect(plain).not.toContain("{#transaction_documents}");
    expect(plain).not.toContain("{notice_date}");
    expect(plain).toContain("[Debtor]");
    expect(plain).toContain("Date: [insert date]");
    expect(plain).toContain("[Name & Address of Debtor]");
    expect(plain).toContain("Account Name: [Insert]");
    expect(plain).toContain(SCHEDULE3_NIL_NOTE);
    expect(plain).toContain("SHORAKA SUYULA PLATFORM SDN. BHD.");
    expect(plain).toContain("SHORAKA SUYULA SDN. BHD.");

    expect(runContaining(xml, "{assignment_date}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{assignor_company_name}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{name}")).toContain('w:val="yellow"');
  });

  it("renders fixture values into particulars without filling Schedule 2 or 3", () => {
    const data = createDeedOfAssignmentFixture();
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);

    expect(plain).toContain(data.assignor_company_name);
    expect(plain).toContain(data.assignment_date);
    expect(plain).toContain("Ali Bin Abu");
    expect(plain).toContain(SCHEDULE3_NIL_NOTE);
    expect(plain).toContain("Date: [insert date]");
    expect(plain).toContain("[Name & Address of Debtor]");
    expect(plain).toContain("[Debtor]");
    expect(plain).not.toContain("INV-001");
    expect(plain).not.toContain("ELECTRONIC SIGNATURES — ASSIGNOR");
    expect(plain).not.toContain("{#assignor_signatories}");
    expect(plain).not.toContain("{#transaction_documents}");
  });

  it("renders one assignor block per authorised representative", () => {
    const two = wordPlainText(renderedXml(createDeedOfAssignmentFixture()));
    expect(two.split("Name: Ali Bin Abu").length - 1).toBe(1);
    expect(two.split("Name: Siti Binti Ahmad").length - 1).toBe(1);
    expect(two.split("In the presence of:").length - 1).toBe(2);

    const oneData = createDeedOfAssignmentFixture();
    oneData.assignor_signatories = [oneData.assignor_signatories[0]!];
    const one = wordPlainText(renderedXml(oneData));
    expect(one).toContain("Name: Ali Bin Abu");
    expect(one).not.toContain("Siti Binti Ahmad");
    expect(one.split("In the presence of:").length - 1).toBe(1);
  });

  it("prints merge tags when scalars are empty", () => {
    const data = createDeedOfAssignmentFixture();
    data.assignor_company_name = "";
    data.trust_swift_code = "";
    data.assignor_signatories = [];
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);
    expect(plain).toContain("{assignor_company_name}");
    expect(plain).toContain("{trust_swift_code}");
    expect(plain).toContain("{name}");
    expect(plain).toContain("{identity_number}");
    expect(plain).toContain("{designation}");
    expect(plain).toContain(SCHEDULE3_NIL_NOTE);
  });
});

describe("arf-notice-of-assignment-template", () => {
  it("contains only the prescribed Schedule 2 form with original placeholders", () => {
    const bytes = fs.readFileSync(resolveNoticeOfAssignmentTemplatePath());
    const zip = new PizZip(bytes);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const plain = wordPlainText(xml);

    expect(plain).toContain("SCHEDULE 2");
    expect(plain).toContain("FORM OF NOTICE OF ASSIGNMENT OF RECEIVABLES");
    expect(plain).toContain("(Letterhead of the Assignor)");
    expect(plain).toContain("Date: [insert date]");
    expect(plain).toContain("[Name & Address of Debtor]");
    expect(plain).toContain("effective from [insert]");
    expect(plain).toContain("Account Name: [Insert]");
    expect(plain).toContain("Account Bank: [Insert]");
    expect(plain).toContain("Account No.: [Insert]");
    expect(plain).toContain("[Debtor]");
    expect(plain).toContain("[Company Name]");
    expect(plain).toContain("ACKNOWLEDGMENT");
    expect(plain).toContain("Attachment: Statement of Account to Debtor");
    expect(plain).not.toContain("THIS DEED OF ASSIGNMENT");
    expect(plain).not.toContain("SCHEDULE 3");
    expect(plain).not.toContain("{notice_date}");
    expect(plain).not.toContain("{assignment_date}");
    expect(plain).not.toContain("{#");
  });
});
