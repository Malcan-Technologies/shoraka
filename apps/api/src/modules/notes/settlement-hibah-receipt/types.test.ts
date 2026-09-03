import { formatPaymentReferences } from "./types";

describe("formatPaymentReferences", () => {
  it("prints a single reference as-is", () => {
    expect(formatPaymentReferences(["  ABC-1  "])).toBe("ABC-1");
  });

  it("joins unique references in a stable sorted order", () => {
    expect(formatPaymentReferences(["zeta", "alpha", "alpha", " beta "])).toBe(
      "alpha · beta · zeta"
    );
  });

  it("prints an em dash when no non-empty reference exists", () => {
    expect(formatPaymentReferences(["", "  ", "\t"])).toBe("—");
    expect(formatPaymentReferences([])).toBe("—");
  });
});
