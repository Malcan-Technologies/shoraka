import { extractGovernmentIdFromCorporateUserInfo } from "./extract-government-id";

describe("extractGovernmentIdFromCorporateUserInfo", () => {
  it("reads a flat formContent.content array", () => {
    expect(
      extractGovernmentIdFromCorporateUserInfo({
        formContent: {
          content: [{ fieldName: "Government ID Number", fieldValue: "891114075601" }],
        },
      })
    ).toBe("891114075601");
  });

  it("reads a wrapped formContent.content.content array", () => {
    expect(
      extractGovernmentIdFromCorporateUserInfo({
        formContent: {
          content: {
            content: [{ fieldName: "Government ID Number", fieldValue: "891114075601" }],
          },
        },
      })
    ).toBe("891114075601");
  });

  it("falls back to governmentIdNumber when the form tree is empty", () => {
    expect(
      extractGovernmentIdFromCorporateUserInfo({
        governmentIdNumber: "900101011111",
        formContent: { content: { content: [] } },
      })
    ).toBe("900101011111");
  });
});
