import { matchingLegalDocumentTypes } from "./search-match";

describe("matchingLegalDocumentTypes", () => {
  it("matches visible labels, partial text, and case-insensitive queries", () => {
    expect(matchingLegalDocumentTypes("Terms of Use")).toEqual(["TERMS_OF_USE"]);
    expect(matchingLegalDocumentTypes("terms")).toEqual(["TERMS_OF_USE"]);
    expect(matchingLegalDocumentTypes("PDPA")).toEqual(["PDPA_NOTICE_AND_CONSENT"]);
  });
});
