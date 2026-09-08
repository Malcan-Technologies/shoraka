import {
  applyPartyComrepSemantics,
  isScGenderAllowedForEntity,
  isScIdentityPrefixAllowed,
  normalizeScIdentityNumber,
  othersSpecifyValue,
  scGendersForEntityType,
} from "./comrep-semantic-rules";

describe("ComRep gender by entity type", () => {
  it("allows only Male/Female for an individual", () => {
    expect(scGendersForEntityType("INDIVIDUAL")).toEqual(["MALE", "FEMALE"]);
    expect(isScGenderAllowedForEntity("INDIVIDUAL", "MALE")).toBe(true);
    expect(isScGenderAllowedForEntity("INDIVIDUAL", "NOT_APPLICABLE")).toBe(false);
  });

  it("allows only Not Applicable for a company", () => {
    expect(scGendersForEntityType("CORPORATE")).toEqual(["NOT_APPLICABLE"]);
    expect(isScGenderAllowedForEntity("CORPORATE", "FEMALE")).toBe(false);
    expect(isScGenderAllowedForEntity("CORPORATE", "NOT_APPLICABLE")).toBe(true);
  });

  it("does not treat a blank individual gender as Not Applicable", () => {
    expect(isScGenderAllowedForEntity("INDIVIDUAL", null)).toBe(true);
    expect(isScGenderAllowedForEntity("INDIVIDUAL", "")).toBe(true);
  });
});

describe("ComRep identity prefix and number", () => {
  it("locks a company to ROC and officers to IC/Passport", () => {
    expect(isScIdentityPrefixAllowed({ entityType: "CORPORATE", prefix: "ROC" })).toBe(true);
    expect(isScIdentityPrefixAllowed({ entityType: "CORPORATE", prefix: "NRIC" })).toBe(false);
    expect(
      isScIdentityPrefixAllowed({ entityType: "INDIVIDUAL", officerOnly: true, prefix: "ROC" })
    ).toBe(false);
    expect(
      isScIdentityPrefixAllowed({ entityType: "INDIVIDUAL", officerOnly: true, prefix: "PASSPORT" })
    ).toBe(true);
  });

  it("strips NRIC and ROC formatting but leaves passport characters", () => {
    expect(
      normalizeScIdentityNumber({
        value: "800101-01-1234",
        entityType: "INDIVIDUAL",
        prefix: "NRIC",
      })
    ).toBe("800101011234");
    expect(
      normalizeScIdentityNumber({
        value: "1234567-A",
        entityType: "CORPORATE",
        prefix: "ROC",
      })
    ).toBe("1234567A");
    expect(
      normalizeScIdentityNumber({
        value: "K 123456",
        entityType: "INDIVIDUAL",
        prefix: "PASSPORT",
      })
    ).toBe("K 123456");
  });
});

describe("ComRep Others (please specify)", () => {
  it("requires text only when Others is selected and clears it otherwise", () => {
    expect(othersSpecifyValue("OTHERS", "")).toEqual({
      value: null,
      issue: "Enter the other value because ‘Others’ is selected.",
    });
    expect(othersSpecifyValue("OTHERS", "Redeemable preference")).toEqual({
      value: "Redeemable preference",
      issue: null,
    });
    expect(othersSpecifyValue("ORDINARY", "leftover")).toEqual({ value: null, issue: null });
  });
});

describe("applyPartyComrepSemantics", () => {
  it("forces company gender, prefix, and empty salutation", () => {
    const applied = applyPartyComrepSemantics({
      entityType: "CORPORATE",
      isOfficer: false,
      gender: "MALE",
      salutation: "Dato'",
      identityPrefix: "NRIC",
      identityNumber: "1234567-A",
      shareType: "ORDINARY",
      shareTypeOther: "should clear",
    });
    expect(applied.gender).toBe("NOT_APPLICABLE");
    expect(applied.salutation).toBeNull();
    expect(applied.identityPrefix).toBe("ROC");
    expect(applied.identityNumber).toBe("1234567A");
    expect(applied.shareTypeOther).toBeNull();
    expect(applied.issues).toEqual([]);
  });

  it("rejects Not Applicable for an individual and ROC prefix", () => {
    const applied = applyPartyComrepSemantics({
      entityType: "INDIVIDUAL",
      isOfficer: true,
      gender: "NOT_APPLICABLE",
      identityPrefix: "ROC",
      nationality: "MALAYSIA",
    });
    expect(applied.issues.length).toBeGreaterThan(0);
    expect(applied.issues.some((issue) => /Not Applicable/i.test(issue))).toBe(true);
  });

  it("requires Type of Shares - Others when Others is selected", () => {
    const applied = applyPartyComrepSemantics({
      entityType: "INDIVIDUAL",
      isOfficer: false,
      shareType: "OTHERS",
      shareTypeOther: "  ",
    });
    expect(applied.issues.some((issue) => /other share type/i.test(issue))).toBe(true);
  });
});
