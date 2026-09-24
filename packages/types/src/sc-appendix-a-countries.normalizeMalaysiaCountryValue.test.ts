import {
  normalizeMalaysiaCountryValue,
  scAppendixASelectValuesMalaysiaCanonicalized,
  toMalaysiaCanonicalSelectableValue,
} from "./sc-appendix-a-countries";

describe("normalizeMalaysiaCountryValue", () => {
  it("normalizes MY/MYS/Malaysia to Malaysia", () => {
    expect(normalizeMalaysiaCountryValue("MY")).toBe("Malaysia");
    expect(normalizeMalaysiaCountryValue("mys")).toBe("Malaysia");
    expect(normalizeMalaysiaCountryValue("Malaysia")).toBe("Malaysia");
  });

  it("leaves unrelated values unchanged", () => {
    expect(normalizeMalaysiaCountryValue("SINGAPORE")).toBe("SINGAPORE");
    expect(normalizeMalaysiaCountryValue("SG")).toBe("SG");
    expect(normalizeMalaysiaCountryValue("")).toBe("");
    expect(normalizeMalaysiaCountryValue(null)).toBe(null);
    expect(normalizeMalaysiaCountryValue(undefined)).toBe(undefined);
  });

  it("maps Malaysia variants to Appendix A canonical select value", () => {
    expect(toMalaysiaCanonicalSelectableValue("MY")).toBe("MALAYSIA");
    expect(toMalaysiaCanonicalSelectableValue("MYS")).toBe("MALAYSIA");
    expect(toMalaysiaCanonicalSelectableValue("Malaysia")).toBe("MALAYSIA");
    expect(toMalaysiaCanonicalSelectableValue("MALAYSIA")).toBe("MALAYSIA");
  });

  it("does not change unrelated values for select purposes", () => {
    expect(toMalaysiaCanonicalSelectableValue("SINGAPORE")).toBe("SINGAPORE");
    expect(toMalaysiaCanonicalSelectableValue("SG")).toBe("SG");
  });

  it("dedupes Malaysia variants into a single MALAYSIA option", () => {
    const opts = scAppendixASelectValuesMalaysiaCanonicalized("MY");
    expect(opts.filter((v) => v === "MALAYSIA")).toHaveLength(1);
    expect(opts).not.toContain("MY");

    const opts2 = scAppendixASelectValuesMalaysiaCanonicalized("MALAYSIA");
    expect(opts2.filter((v) => v === "MALAYSIA")).toHaveLength(1);
  });

  it("leaves other options unchanged (including custom current value)", () => {
    const opts = scAppendixASelectValuesMalaysiaCanonicalized("SINGAPORE_X");
    expect(opts[0]).toBe("SINGAPORE_X");
  });
});

