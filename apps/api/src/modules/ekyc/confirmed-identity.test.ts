import { parseConfirmedEkycName } from "./confirmed-identity";

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
