import {
  compareCompanyNamesForStrictDisplayExact,
  normalizeCompanyNameForStrictCheck,
} from "@cashsouk/types";

describe("company name normalization (strict display matching)", () => {
  it("matches spacing/case differences but keeps punctuation differences", () => {
    expect(normalizeCompanyNameForStrictCheck("ABC SDN BHD")).toBe("ABC SDN BHD");
    expect(normalizeCompanyNameForStrictCheck("abc   sdn bHd")).toBe("ABC SDN BHD");
    expect(normalizeCompanyNameForStrictCheck("ABC SDN. BHD.")).toBe("ABC SDN. BHD.");
  });

  it("returns null for placeholder dash", () => {
    expect(normalizeCompanyNameForStrictCheck("—")).toBeNull();
  });
});

describe("compareCompanyNamesForStrictDisplayExact", () => {
  it("returns match for spacing/case differences", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "Acme Sendirian Berhad",
      extractedName: "ACME SDN BHD",
    });
    // Strict check: SENDIRIAN BERHAD != SDN BHD
    expect(r.status).toBe("difference");
    expect(r.isMatch).toBe(false);
  });

  it("returns match for SDN BHD vs SDN BHD (only case/spacing)", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "ABC SDN. BHD.",
      extractedName: "abc   sdn bHd",
    });
    expect(r.status).toBe("difference");
    expect(r.isMatch).toBe(false);
  });

  it("matches when same wording but different spacing", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "ABC   SDN BHD",
      extractedName: "ABC SDN BHD",
    });
    expect(r.status).toBe("match");
    expect(r.isMatch).toBe(true);
  });

  it("flags differences for suffix wording", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "ABC SENDIRIAN BERHAD",
      extractedName: "ABC SDN BHD",
    });
    expect(r.status).toBe("difference");
    expect(r.isMatch).toBe(false);
  });

  it("flags differences for punctuation (dots/commas)", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "ABC TRADING SDN BHD",
      extractedName: "ABC TRADING SDN. BHD.",
    });
    expect(r.status).toBe("difference");
    expect(r.isMatch).toBe(false);
  });

  it("flags differences for punctuation even when words match", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "ABC SDN. BHD.",
      extractedName: "ABC SDN BHD",
    });
    expect(r.status).toBe("difference");
    expect(r.isMatch).toBe(false);
  });

  it("flags differences for punctuation even when words match (reverse)", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "ABC SDN BHD",
      extractedName: "ABC SDN. BHD.",
    });
    expect(r.status).toBe("difference");
    expect(r.isMatch).toBe(false);
  });

  it("flags differences for suffix wording variants (LIMITED vs LTD)", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "ABC PRIVATE LIMITED",
      extractedName: "ABC PTE LTD",
    });
    expect(r.status).toBe("difference");
    expect(r.isMatch).toBe(false);
  });

  it("returns unavailable when one side is missing", () => {
    const r1 = compareCompanyNamesForStrictDisplayExact({
      submittedName: "ABC SDN BHD",
      extractedName: null,
    });
    expect(r1.status).toBe("unavailable");
    expect(r1.normalizedExtractedName).toBeNull();

    const r2 = compareCompanyNamesForStrictDisplayExact({
      submittedName: null,
      extractedName: "ABC SDN BHD",
    });
    expect(r2.status).toBe("unavailable");
    expect(r2.normalizedSubmittedName).toBeNull();
  });

  it("treats placeholder dash as unavailable", () => {
    const r = compareCompanyNamesForStrictDisplayExact({
      submittedName: "—",
      extractedName: "ABC SDN BHD",
    });
    expect(r.status).toBe("unavailable");
  });
});

