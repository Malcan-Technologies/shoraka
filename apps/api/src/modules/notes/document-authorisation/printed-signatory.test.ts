import { printedSignatoryName, printedSignatoryNameAndDate } from "./printed-signatory";

describe("printedSignatoryName", () => {
  it("prefers the frozen signing person name over the legacy authorised-signatory field", () => {
    expect(
      printedSignatoryName({
        signingPersonName: "John Lee",
        authorisedSignatoryName: "Legacy Name",
      })
    ).toBe("John Lee");
    expect(printedSignatoryName({ authorisedSignatoryName: "Ahmad" })).toBe("Ahmad");
    expect(printedSignatoryName({})).toBe("");
  });
});

describe("printedSignatoryNameAndDate", () => {
  it("prints name / date when a frozen name exists", () => {
    expect(
      printedSignatoryNameAndDate(
        { signingPersonName: "John Lee", authorisedSignatoryName: "Legacy" },
        "02 Sep 2026"
      )
    ).toBe("John Lee / 02 Sep 2026");
    expect(printedSignatoryNameAndDate({ authorisedSignatoryName: "" }, "02 Sep 2026")).toBe(
      "02 Sep 2026"
    );
  });
});
