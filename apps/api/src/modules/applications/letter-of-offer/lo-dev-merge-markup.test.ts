import {
  highlightMergeTagsInWordXml,
  replaceEmptyMergeValuesWithTags,
} from "./lo-dev-merge-markup";

describe("highlightMergeTagsInWordXml", () => {
  it("splits a mixed run so only the merge tag is yellow", () => {
    const xml =
      `<w:p><w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>` +
      `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>Up to {tenure_days} days</w:t></w:r></w:p>`;
    const out = highlightMergeTagsInWordXml(xml);
    expect(out).toContain('<w:t xml:space="preserve">Up to </w:t>');
    expect(out).toMatch(
      /<w:highlight w:val="yellow"\/>\s*<\/w:rPr>\s*<w:t>\{tenure_days\}<\/w:t>/
    );
    expect(out).toContain("<w:t xml:space=\"preserve\"> days</w:t>");
    expect(out.match(/<w:highlight w:val="yellow"\/>/g)?.length).toBe(1);
  });

  it("joins a tag split across proofErr runs and keeps a tab before it", () => {
    const xml =
      `<w:p><w:pPr></w:pPr>` +
      `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>Attention :</w:t></w:r>` +
      `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:tab/></w:r>` +
      `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>{</w:t></w:r>` +
      `<w:proofErr w:type="spellStart"/>` +
      `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>attention_name</w:t></w:r>` +
      `<w:proofErr w:type="spellEnd"/>` +
      `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>}</w:t></w:r></w:p>`;
    const out = highlightMergeTagsInWordXml(xml);
    expect(out).toContain("<w:tab/>");
    expect(out).toContain("{attention_name}");
    expect(out).not.toContain("<w:t>{</w:t>");
    expect(out).toMatch(
      /<w:highlight w:val="yellow"\/>\s*<\/w:rPr>\s*<w:t>\{attention_name\}<\/w:t>/
    );
  });

  it("keeps checkbox font on the joined tag and does not highlight loop delimiters", () => {
    const xml =
      `<w:p>` +
      `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol"/><w:sz w:val="20"/></w:rPr>` +
      `<w:t>{part_a_</w:t></w:r>` +
      `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol"/><w:sz w:val="20"/></w:rPr>` +
      `<w:t>checkbox}</w:t></w:r>` +
      `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">  Part A</w:t></w:r></w:p>`;
    const out = highlightMergeTagsInWordXml(xml);
    expect(out).toContain("{part_a_checkbox}");
    expect(out).toContain('w:ascii="Segoe UI Symbol"');
    expect(out).toMatch(
      /Segoe UI Symbol[\s\S]*<w:highlight w:val="yellow"\/>[\s\S]*\{part_a_checkbox\}/
    );
    const loopXml = highlightMergeTagsInWordXml(
      `<w:p><w:r><w:t>{#guarantors_individual}</w:t></w:r></w:p>`
    );
    expect(loopXml).toContain("{#guarantors_individual}");
    expect(loopXml).not.toContain("w:highlight");
  });
});

describe("replaceEmptyMergeValuesWithTags", () => {
  it("fills empty scalar and nested strings with the merge tag", () => {
    const out = replaceEmptyMergeValuesWithTags({
      tenure_days: "",
      issuer_name: "Acme",
      guarantors_individual: [{ name: "Ali", nric: "", line: "" }],
    });
    expect(out).toEqual({
      tenure_days: "{tenure_days}",
      issuer_name: "Acme",
      guarantors_individual: [{ name: "Ali", nric: "{nric}", line: "{line}" }],
    });
  });

  it("leaves page_break empty so omitted breaks stay omitted", () => {
    const out = replaceEmptyMergeValuesWithTags({
      page_break: "",
      left: "",
    }) as { page_break: string; left: string };
    expect(out.page_break).toBe("");
    expect(out.left).toBe("{left}");
  });
});
