import { normalizeMalaysiaCountryValue } from "./sc-appendix-a-countries";

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
});

