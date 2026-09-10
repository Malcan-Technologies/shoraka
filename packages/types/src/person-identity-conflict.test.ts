import {
  IDENTITY_CONFLICT_ISSUER_LABEL,
  isBlockedPersonIdentityConflict,
  observedPartyBlockedByIdentityConflict,
  parsePersonIdentityConflict,
  readPersonIdentityConflict,
} from "./person-identity-conflict";

describe("person identity conflict", () => {
  const blocked = {
    status: "BLOCKED",
    canonicalIdentity: "900101101234",
    otherPartyId: "obs-1",
    otherPartyKey: "900101101234",
    otherMembershipStatus: "EXTERNAL_OBSERVED",
    source: "REGTANK_QUERY",
    at: "2026-09-10T00:00:00.000Z",
  };

  it("reads a nested identityConflict from observation JSON", () => {
    expect(readPersonIdentityConflict({ identityConflict: blocked })).toMatchObject(blocked);
    expect(parsePersonIdentityConflict(blocked)?.canonicalIdentity).toBe("900101101234");
    expect(isBlockedPersonIdentityConflict(readPersonIdentityConflict({ identityConflict: blocked }))).toBe(
      true
    );
  });

  it("ignores resolved or incomplete markers", () => {
    expect(
      isBlockedPersonIdentityConflict(
        parsePersonIdentityConflict({ ...blocked, status: "RESOLVED_KEEP_ONBOARDING" })
      )
    ).toBe(false);
    expect(parsePersonIdentityConflict({ status: "BLOCKED" })).toBeNull();
  });

  it("detects an observed Person targeted by a MASTER_ACTIVE blocked conflict", () => {
    expect(
      observedPartyBlockedByIdentityConflict({
        observedPartyId: "obs-1",
        observedPartyKey: "900101101234",
        parties: [
          {
            id: "onb-1",
            membershipStatus: "MASTER_ACTIVE",
            externalObservation: { identityConflict: blocked },
          },
        ],
      })
    ).toBe(true);
    expect(
      observedPartyBlockedByIdentityConflict({
        observedPartyId: "obs-1",
        parties: [{ id: "onb-1", membershipStatus: "MASTER_INACTIVE", externalObservation: { identityConflict: blocked } }],
      })
    ).toBe(false);
    expect(
      observedPartyBlockedByIdentityConflict({
        observedPartyId: "obs-1",
        observedPartyKey: "900101101234",
        parties: [
          {
            id: "onb-1",
            membershipStatus: "MASTER_ACTIVE",
            externalObservation: { identityConflict: { ...blocked, status: "RESOLVED_KEEP_ONBOARDING" } },
          },
        ],
      })
    ).toBe(true);
    expect(IDENTITY_CONFLICT_ISSUER_LABEL).toBe("Identity needs Admin review");
  });
});
