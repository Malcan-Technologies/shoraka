import PizZip from "pizzip";
import { createDeedOfAssignmentFixture } from "./doa-fixture";
import type { DeedOfAssignmentMergeData } from "./doa-merge.types";
import {
  readDeedOfAssignmentTemplateBytes,
  renderDeedOfAssignmentDocx,
  resolveDeedOfAssignmentTemplatePath,
} from "./render-doa-docx";

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

describe("renderDeedOfAssignmentDocx", () => {
  it("resolves the tagged template file", () => {
    expect(resolveDeedOfAssignmentTemplatePath()).toMatch(/arf-deed-of-assignment\.docx$/);
  });

  it("keeps yellow value tags, Schedule 3 loop, and wet-ink execution", () => {
    const zip = new PizZip(readDeedOfAssignmentTemplateBytes());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const plain = wordPlainText(xml);

    expect(plain).toContain("is made on {assignment_date}");
    expect(plain).toContain("{assignor_company_name}");
    expect(plain).toContain("{trust_swift_code}");
    expect(plain).toContain("{#transaction_documents}");
    expect(plain).toContain("{/transaction_documents}");
    expect(plain).toContain("{#assignor_signatories}");
    expect(plain).toContain("{/assignor_signatories}");
    expect(plain).toContain("Name: {name}");
    expect(plain).toContain("In the presence of:");
    expect(plain).toContain("[Witness]");
    expect(plain).not.toContain("ELECTRONIC SIGNATURES — ASSIGNOR");
    expect(plain).not.toContain("{assignor_signatory_1_name}");
    expect(plain).toContain("[Debtor]");
    expect(plain).toContain("SHORAKA SUYULA PLATFORM SDN. BHD.");
    expect(plain).toContain("SHORAKA SUYULA SDN. BHD.");
    expect(plain).not.toContain("[insert date]");
    expect(plain).not.toContain("[Insert]");

    expect(runContaining(xml, "{assignment_date}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{assignor_company_name}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{due_date}")).toContain('w:val="yellow"');
    expect(runContaining(xml, "{name}")).toContain('w:val="yellow"');
  });

  it("renders fixture values into the particulars, notice, and Schedule 3", () => {
    const data = createDeedOfAssignmentFixture();
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);

    expect(plain).toContain(data.assignor_company_name);
    expect(plain).toContain(data.assignment_date);
    expect(plain).toContain("Ali Bin Abu");
    expect(plain).toContain("INV-001");
    expect(plain).toContain("BUYER CO SDN. BHD.");
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

  it("prints merge tags when scalars and Schedule 3 are empty", () => {
    const data = createDeedOfAssignmentFixture();
    data.assignor_company_name = "";
    data.trust_swift_code = "";
    data.debtor_address = "";
    data.transaction_documents = [];
    data.assignor_signatories = [];
    const xml = renderedXml(data);
    const plain = wordPlainText(xml);
    expect(plain).toContain("{assignor_company_name}");
    expect(plain).toContain("{trust_swift_code}");
    expect(plain).toContain("{debtor_address}");
    expect(plain).toContain("{transaction_document_name_number}");
    expect(plain).toContain("{due_date}");
    expect(plain).toContain("{name}");
    expect(plain).toContain("{identity_number}");
    expect(plain).toContain("{designation}");
  });
});
