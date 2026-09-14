import { solidifySignatureLinesInXml } from "./solid-signature-lines";

describe("solidifySignatureLinesInXml", () => {
  it("left-aligns underscore-only rows and tightens glyph spacing", () => {
    const xml = [
      `<w:p><w:pPr><w:jc w:val="both"/></w:pPr>`,
      `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>_______________________________</w:t></w:r>`,
      `</w:p>`,
    ].join("");

    const next = solidifySignatureLinesInXml(xml);
    expect(next).toContain('<w:jc w:val="left"/>');
    expect(next).not.toContain('<w:jc w:val="both"/>');
    expect(next).toContain('<w:spacing w:val="-40"/>');
    expect(next).toContain("_______________________________");
    expect(next).not.toContain('w:val="FFFFFF"');
    expect(next).not.toContain('<w:u w:val="single"');
  });

  it("keeps dotted signature strokes unchanged", () => {
    const xml =
      `<w:p><w:r><w:t>...........................................................................</w:t></w:r></w:p>`;
    expect(solidifySignatureLinesInXml(xml)).toBe(xml);
  });

  it("leaves Date labels and their underscores in one run", () => {
    const xml = `<w:p><w:r><w:t xml:space="preserve">Date: ________________</w:t></w:r></w:p>`;
    expect(solidifySignatureLinesInXml(xml)).toBe(xml);
  });

  it("keeps hanging-tab signature rows justified and tightens the stroke glyphs", () => {
    const xml = `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:tab/></w:r><w:r><w:t>_______________________________</w:t></w:r></w:p>`;
    const next = solidifySignatureLinesInXml(xml);
    expect(next).toContain('<w:jc w:val="both"/>');
    expect(next).not.toContain('<w:jc w:val="left"/>');
    expect(next).toContain('<w:spacing w:val="-40"/>');
  });
});
