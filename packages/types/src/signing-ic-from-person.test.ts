import { signingIcFromPerson } from "./signing-envelopes";

describe("signingIcFromPerson", () => {
  it("uses identityNumber when matchKey is a generated user key", () => {
    expect(
      signingIcFromPerson({
        matchKey: "user:550e8400-e29b-41d4-a716-446655440000",
        identityNumber: "820508-10-5871",
      })
    ).toBe("820508105871");
  });

  it("does not treat a generated user key as IC", () => {
    expect(
      signingIcFromPerson({
        matchKey: "user:550e8400-e29b-41d4-a716-446655440000",
        identityNumber: null,
      })
    ).toBe("");
  });

  it("uses a 12-digit matchKey when identityNumber is missing", () => {
    expect(
      signingIcFromPerson({
        matchKey: "820508105871",
        identityNumber: null,
      })
    ).toBe("");
  });
});
