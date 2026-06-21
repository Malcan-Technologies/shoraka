import { maskMalaysianIcNumber, parseConfirmedEkycName } from "./confirmed-identity";

describe("parseConfirmedEkycName", () => {
  it("returns null when name is omitted", () => {
    expect(parseConfirmedEkycName()).toBeNull();
    expect(parseConfirmedEkycName("")).toBeNull();
  });

  it("normalizes confirmed name", () => {
    expect(parseConfirmedEkycName("  lucas   deng  ")).toBe("LUCAS DENG");
  });

  it("returns null for whitespace-only names", () => {
    expect(parseConfirmedEkycName("   ")).toBeNull();
  });
});

describe("maskMalaysianIcNumber", () => {
  it("masks the middle digits of a 12-digit IC", () => {
    expect(maskMalaysianIcNumber("820508105871")).toBe("820508•••871");
  });
});
