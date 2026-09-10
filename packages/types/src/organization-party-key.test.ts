import {
  canonicalPartyIdentityKey,
  displayGovernmentIdentityNumber,
  findExistingPartyForIdentityKey,
  governmentIdNumberForOnboardingSend,
  isCtosComparableParty,
  isGeneratedUserPartyKey,
  isManagementOnlyParty,
  partyKeyMatchesLookup,
  partySeenInExternalKeys,
  resolvePartyLookupKey,
  stripGeneratedPartyKeyPrefix,
  usablePersonSendName,
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

  it("does not treat the uuid suffix of user:{uuid} as an NRIC", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const rows = [{ party_key: `user:${uuid}`, identity_number: null, name: "Pre-ID" }];
    expect(findExistingPartyForIdentityKey(rows, uuid)).toBeUndefined();
    expect(findExistingPartyForIdentityKey(rows, uuid.replace(/-/g, ""))).toBeUndefined();
    expect(findExistingPartyForIdentityKey(rows, `user:${uuid}`)?.name).toBe("Pre-ID");
  });

  it("matches a generated Person to CTOS via identity_number only", () => {
    const rows = [
      {
        party_key: "user:550e8400-e29b-41d4-a716-446655440000",
        identity_number: "900101-10-1234",
        name: "Sarah",
      },
    ];
    expect(findExistingPartyForIdentityKey(rows, "900101101234")?.name).toBe("Sarah");
    expect(findExistingPartyForIdentityKey(rows, "900101101234")?.party_key).toBe(
      "user:550e8400-e29b-41d4-a716-446655440000"
    );
  });

  it("keeps generated lookup keys exact and does not send them as government ID", () => {
    const key = "user:550e8400-e29b-41d4-a716-446655440000";
    expect(resolvePartyLookupKey(key)).toBe(key);
    expect(resolvePartyLookupKey("900101-10-1234")).toBe("900101101234");
    expect(partyKeyMatchesLookup(key, key)).toBe(true);
    expect(partyKeyMatchesLookup(key, "USER550E8400E29B41D4A716446655440000")).toBe(false);
    expect(displayGovernmentIdentityNumber({ partyKey: key, identityNumber: null })).toBeNull();
    expect(
      displayGovernmentIdentityNumber({ partyKey: key, identityNumber: "900101101234" })
    ).toBe("900101101234");
    expect(governmentIdNumberForOnboardingSend({ partyKey: key, identityNumber: null })).toBe("");
    expect(
      governmentIdNumberForOnboardingSend({
        partyKey: key,
        identityNumber: "900101-10-1234",
      })
    ).toBe("900101101234");
    expect(
      governmentIdNumberForOnboardingSend({
        partyKey: "900101101234",
        identityNumber: "900101-10-1234",
      })
    ).toBe("900101101234");
    expect(usablePersonSendName("")).toBeNull();
    expect(usablePersonSendName("   ")).toBeNull();
    expect(usablePersonSendName("Ahmad")).toBe("Ahmad");
  });

  it("marks only directors/shareholders as CTOS-comparable", () => {
    expect(isCtosComparableParty({ isDirector: true, isShareholder: false })).toBe(true);
    expect(isCtosComparableParty({ isDirector: false, isShareholder: true })).toBe(true);
    expect(isManagementOnlyParty({ isDirector: false, isShareholder: false, isManagement: true })).toBe(
      true
    );
  });

  it("does not match an individual NRIC to a company with the same digits", () => {
    const rows = [
      {
        party_key: "1234567A",
        identity_number: "1234567A",
        entity_type: "CORPORATE",
        name: "HoldCo",
      },
    ];
    expect(findExistingPartyForIdentityKey(rows, "1234567A", { entityType: "INDIVIDUAL" })).toBeUndefined();
    expect(findExistingPartyForIdentityKey(rows, "1234567A", { entityType: "CORPORATE" })?.name).toBe(
      "HoldCo"
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
