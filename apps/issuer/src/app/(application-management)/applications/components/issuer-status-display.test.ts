import { formatApplicationReference } from "@cashsouk/types";

describe("issuer application display reference", () => {
  it("prefers canonical application reference", () => {
    expect(
      formatApplicationReference({
        id: "clabcdefghijklmnop",
        displayReference: "APP-ARF-202608-A82",
      })
    ).toBe("APP-ARF-202608-A82");
  });

  it("falls back to short id for historical applications", () => {
    expect(formatApplicationReference({ id: "clabcdefghijklmnop" })).toBe("#IJKLMNOP");
  });
});
