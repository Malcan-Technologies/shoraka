import {
  compareOfficialDocumentVersions,
  formatOfficialDocumentVersion,
  latestOfficialDocumentVersion,
  nextOfficialDocumentVersion,
  parseOfficialDocumentVersionNumber,
} from "./official-document-version";

describe("official document versions", () => {
  it("parses, formats, and increments V01/V02/V03", () => {
    expect(parseOfficialDocumentVersionNumber("V01")).toBe(1);
    expect(formatOfficialDocumentVersion(2)).toBe("V02");
    expect(nextOfficialDocumentVersion("V01")).toBe("V02");
    expect(nextOfficialDocumentVersion("V02")).toBe("V03");
    expect(compareOfficialDocumentVersions("V03", "V01")).toBeGreaterThan(0);
    expect(latestOfficialDocumentVersion(["V01", "V03", "V02"])).toBe("V03");
  });
});
