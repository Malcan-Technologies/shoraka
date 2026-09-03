import {
  canonicalPartyIdentityKey,
  findExistingPartyForIdentityKey,
  isCtosComparableParty,
  isGeneratedUserPartyKey,
  isManagementOnlyParty,
  partySeenInExternalKeys,
  stripGeneratedPartyKeyPrefix,
} from "./organization-party-key";

describe("organization party key matching", () => {
  it("normalizes hyphenated NRIC to the same identity key", () => {
    expect(canonicalPartyIdentityKey("900101-10-1234")).toBe("900101101234");
    expect(canonicalPartyIdentityKey("900101101234")).toBe("900101101234");
  });

  it("matches a user-added row to later CTOS identity", () => {
    const rows = [
      { party_key: "900101101234", identity_number: "900101101234", name: "Sarah" },
    ];
    expect(findExistingPartyForIdentityKey(rows, "900101-10-1234")?.name).toBe("Sarah");
  });

  it("matches a legacy mgmt: key to the same NRIC", () => {
    const rows = [
      { party_key: "mgmt:900101101234", identity_number: "900101-10-1234", name: "Sarah" },
    ];
    expect(findExistingPartyForIdentityKey(rows, "900101101234")?.name).toBe("Sarah");
  });

  it("does not treat a generated user: key as the same person as an NRIC", () => {
    const rows = [{ party_key: "user:abc123", identity_number: null, name: "CFO" }];
    expect(findExistingPartyForIdentityKey(rows, "900101101234")).toBeUndefined();
    expect(isGeneratedUserPartyKey("user:abc123")).toBe(true);
    expect(stripGeneratedPartyKeyPrefix("mgmt:900101101234")).toBe("900101101234");
  });

  it("marks only directors/shareholders as CTOS-comparable", () => {
    expect(isCtosComparableParty({ isDirector: true, isShareholder: false })).toBe(true);
    expect(isCtosComparableParty({ isDirector: false, isShareholder: true })).toBe(true);
    expect(isManagementOnlyParty({ isDirector: false, isShareholder: false, isManagement: true })).toBe(
      true
    );
  });

  it("treats an identity-keyed row as seen when CTOS returns the normalized NRIC", () => {
    const seen = new Set(["900101101234"]);
    expect(
      partySeenInExternalKeys(
        { party_key: "mgmt:900101101234", identity_number: "900101-10-1234" },
        seen
      )
    ).toBe(true);
    expect(
      partySeenInExternalKeys({ party_key: "user:abc", identity_number: null }, seen)
    ).toBe(false);
  });
});
