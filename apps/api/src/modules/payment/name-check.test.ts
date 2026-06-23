import { NameCheckResult } from "@prisma/client";
import { normalizeNameForCheck, runNameCheck } from "./name-check";

describe("normalizeNameForCheck", () => {
  it.each([
    ["John Doe", "JOHN DOE"],
    ["  john   doe  ", "JOHN DOE"],
    ["JOHN-DOE", "JOHN DOE"],
    ["Tan Sri Ahmad bin Abdullah", "TAN SRI AHMAD BIN ABDULLAH"],
    ["ABC SDN. BHD.", "ABC SDN BHD"],
  ])("normalizes %j → %j", (input, expected) => {
    expect(normalizeNameForCheck(input)).toBe(expected);
  });

  it("returns null for blank or punctuation-only input", () => {
    expect(normalizeNameForCheck("")).toBeNull();
    expect(normalizeNameForCheck("   ")).toBeNull();
    expect(normalizeNameForCheck("...")).toBeNull();
  });
});

describe("runNameCheck", () => {
  it.each([
    {
      expectedName: "John Doe",
      payerName: "JOHN DOE",
      result: NameCheckResult.PASS,
    },
    {
      expectedName: "Tan Sri Ahmad",
      payerName: "tan  sri-ahmad",
      result: NameCheckResult.PASS,
    },
    {
      expectedName: "John Doe",
      payerName: "Jane Doe",
      result: NameCheckResult.FAIL,
    },
    {
      expectedName: "ABC Trading Sdn Bhd",
      payerName: "ABC TRADING SDN. BHD.",
      result: NameCheckResult.PASS,
    },
  ])(
    "expected=$expectedName payer=$payerName → $result",
    ({ expectedName, payerName, result }) => {
      expect(runNameCheck({ expectedName, payerName })).toBe(result);
    }
  );

  it("returns NAME_UNAVAILABLE when payer name is missing", () => {
    expect(runNameCheck({ expectedName: "John Doe", payerName: null })).toBe(
      NameCheckResult.NAME_UNAVAILABLE
    );
    expect(runNameCheck({ expectedName: "John Doe", payerName: "   " })).toBe(
      NameCheckResult.NAME_UNAVAILABLE
    );
  });

  it("returns NAME_UNAVAILABLE when expected name is missing", () => {
    expect(runNameCheck({ expectedName: null, payerName: "John Doe" })).toBe(
      NameCheckResult.NAME_UNAVAILABLE
    );
  });
});
