import { NameCheckResult } from "@prisma/client";
import { normalizeNameForCheck, runNameCheck, tokenizeNameForCheck } from "./name-check";

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

describe("tokenizeNameForCheck", () => {
  it("drops Malay connector tokens", () => {
    expect(tokenizeNameForCheck("Ahmad bin Abdullah")).toEqual(["AHMAD", "ABDULLAH"]);
    expect(tokenizeNameForCheck("Siti binti Rahman")).toEqual(["SITI", "RAHMAN"]);
    expect(tokenizeNameForCheck("Ali A/L Hassan")).toEqual(["ALI", "HASSAN"]);
  });

  it("strips alias suffix after @", () => {
    expect(tokenizeNameForCheck("JOHN DOE@PERSONAL")).toEqual(["JOHN", "DOE"]);
  });
});

describe("runNameCheck", () => {
  it("passes when payer name matches IC legal name regardless of form-field order", () => {
    const outcome = runNameCheck({
      expectedVariants: ["Kau Khai Kit", "Khai Kit Kau"],
      payerName: "KAU KHAI KIT",
    });
    expect(outcome.decision).toBe(NameCheckResult.PASS);
    expect(outcome.matchedVariant).toBe("Kau Khai Kit");
  });

  it("reviews when middle name is dropped from payer name", () => {
    const outcome = runNameCheck({
      expectedVariants: ["John Michael Doe"],
      payerName: "JOHN DOE",
    });
    expect(outcome.decision).toBe(NameCheckResult.REVIEW);
  });

  it("reviews when payer name includes an honorific title", () => {
    const outcome = runNameCheck({
      expectedVariants: ["Ahmad Abdullah"],
      payerName: "TAN SRI AHMAD ABDULLAH",
    });
    expect(outcome.decision).toBe(NameCheckResult.REVIEW);
  });

  it("fails for clearly different people", () => {
    const outcome = runNameCheck({
      expectedVariants: ["John Doe"],
      payerName: "Jane Smith",
    });
    expect(outcome.decision).toBe(NameCheckResult.FAIL);
  });

  it("passes exact personal name match", () => {
    const outcome = runNameCheck({
      expectedVariants: ["John Doe"],
      payerName: "JOHN DOE",
    });
    expect(outcome.decision).toBe(NameCheckResult.PASS);
  });

  it("passes company names with SDN BHD suffix normalization", () => {
    const outcome = runNameCheck({
      expectedVariants: ["ABC Trading Sdn Bhd"],
      payerName: "ABC TRADING SDN. BHD.",
      isCompany: true,
    });
    expect(outcome.decision).toBe(NameCheckResult.PASS);
  });

  it("reviews near-miss company names", () => {
    const outcome = runNameCheck({
      expectedVariants: ["ABC Trading Sdn Bhd"],
      payerName: "ABC Trading",
      isCompany: true,
    });
    expect(outcome.decision).toBe(NameCheckResult.REVIEW);
  });

  it("returns NAME_UNAVAILABLE when payer name is missing", () => {
    expect(
      runNameCheck({ expectedVariants: ["John Doe"], payerName: null }).decision
    ).toBe(NameCheckResult.NAME_UNAVAILABLE);
    expect(
      runNameCheck({ expectedVariants: ["John Doe"], payerName: "   " }).decision
    ).toBe(NameCheckResult.NAME_UNAVAILABLE);
  });

  it("returns NAME_UNAVAILABLE when expected variants are empty", () => {
    expect(
      runNameCheck({ expectedVariants: [], payerName: "John Doe" }).decision
    ).toBe(NameCheckResult.NAME_UNAVAILABLE);
  });
});
