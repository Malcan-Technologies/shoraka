import {
  CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING,
  resolveDirectorShareholderCtosEmptyWarning,
} from "./application-people-display";

describe("CTOS empty-people copy", () => {
  it("names CTOS when the empty director/shareholder warning is from CTOS", () => {
    expect(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING).toContain("latest CTOS information");
    expect(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING).not.toContain("external information");
    expect(
      resolveDirectorShareholderCtosEmptyWarning({ directorShareholderListSource: "CTOS_EMPTY" })
    ).toBe(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING);
  });
});
