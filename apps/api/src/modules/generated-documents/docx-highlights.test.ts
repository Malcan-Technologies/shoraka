import { assertNoDocxHighlights, stripHighlightsFromDocxXml } from "./docx-highlights";

describe("stripHighlightsFromDocxXml", () => {
  it("removes self-closing and paired highlight tags", () => {
    const xml =
      '<w:r><w:rPr><w:highlight w:val="yellow"/><w:sz w:val="20"/></w:rPr><w:t>Acme</w:t></w:r>' +
      "<w:highlight w:val=\"green\">x</w:highlight>";
    const next = stripHighlightsFromDocxXml(xml);
    expect(next).not.toContain("w:highlight");
    expect(next).toContain("Acme");
    expect(next).toContain('<w:sz w:val="20"/>');
  });
});

describe("assertNoDocxHighlights", () => {
  it("throws when highlight remains", () => {
    expect(() => assertNoDocxHighlights('<w:highlight w:val="yellow"/>')).toThrow(
      /still contains Word highlighting/
    );
  });
});
