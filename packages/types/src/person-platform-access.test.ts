import { resolvePartyCtosComparison } from "./party-ctos-comparison";
import {
  isMemberWithoutCompanyRole,
  linkedPartyUserIds,
  resolvePersonPlatformAccess,
} from "./person-platform-access";

describe("resolvePartyCtosComparison", () => {
  const base = {
    membershipStatus: "MASTER_ACTIVE" as const,
    absentFromLatestExternal: false,
    externalObservation: null as Record<string, unknown> | null,
    mismatches: [] as { field: string; masterValue: unknown; externalValue: unknown; source: null }[],
  };

  it("does not show matched merely because origin was CTOS (no latest comparison)", () => {
    expect(resolvePartyCtosComparison(base).state).toBe("NO_COMPARISON");
  });

  it("shows matched only when latest CTOS comparison agrees", () => {
    expect(
      resolvePartyCtosComparison({
        ...base,
        externalObservation: { name: "Darren" },
      }).state
    ).toBe("MATCHED");
  });

  it("shows differs when the latest comparison has unresolved mismatches", () => {
    expect(
      resolvePartyCtosComparison({
        ...base,
        externalObservation: { name: "Other" },
        mismatches: [{ field: "name", masterValue: "Darren", externalValue: "Other", source: null }],
      }).state
    ).toBe("DIFFERS");
  });

  it("shows not-found when absent from the latest CTOS snapshot", () => {
    expect(
      resolvePartyCtosComparison({
        ...base,
        absentFromLatestExternal: true,
        externalObservation: { name: "Darren" },
      }).state
    ).toBe("NOT_FOUND");
  });

  it("does not treat observed-but-not-adopted people as matched", () => {
    expect(
      resolvePartyCtosComparison({
        ...base,
        membershipStatus: "EXTERNAL_OBSERVED",
        externalObservation: { name: "New" },
      }).state
    ).toBe("NO_COMPARISON");
  });
});

describe("resolvePersonPlatformAccess", () => {
  const partyId = "party-1";

  it("is Not invited when the person has no User and no invitation", () => {
    const access = resolvePersonPlatformAccess({
      linkedUserId: null,
      members: [{ userId: "AAAAA", role: "ORGANIZATION_ADMIN" }],
      invitations: [],
      partyId,
    });
    expect(access.status).toBe("NOT_INVITED");
    expect(access.label).toBe("Not invited");
  });

  it("is pending for a linked unaccepted unexpired invitation", () => {
    const access = resolvePersonPlatformAccess({
      linkedUserId: null,
      members: [],
      invitations: [
        {
          id: "inv-1",
          partyProfileId: partyId,
          accepted: false,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
      partyId,
    });
    expect(access.status).toBe("INVITATION_PENDING");
  });

  it("is expired when the person-scoped invitation has lapsed", () => {
    const access = resolvePersonPlatformAccess({
      linkedUserId: null,
      members: [],
      invitations: [
        {
          id: "inv-exp",
          partyProfileId: partyId,
          accepted: false,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
      partyId,
    });
    expect(access.status).toBe("INVITATION_EXPIRED");
  });

  it("shows Organization Member / Admin from the membership row, not email", () => {
    expect(
      resolvePersonPlatformAccess({
        linkedUserId: "BBBBB",
        members: [{ userId: "BBBBB", role: "ORGANIZATION_MEMBER" }],
        invitations: [],
        partyId,
      }).status
    ).toBe("ORGANIZATION_MEMBER");
    expect(
      resolvePersonPlatformAccess({
        linkedUserId: "CCCCC",
        members: [{ userId: "CCCCC", role: "ORGANIZATION_ADMIN" }],
        invitations: [],
        partyId,
      }).status
    ).toBe("ORGANIZATION_ADMIN");
  });

  it("is No platform access when a User is linked but has no membership", () => {
    const access = resolvePersonPlatformAccess({
      linkedUserId: "AAAAA",
      members: [],
      invitations: [
        {
          id: "inv-exp",
          partyProfileId: partyId,
          accepted: false,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
      partyId,
    });
    expect(access.status).toBe("NO_PLATFORM_ACCESS");
    expect(access.label).toBe("No platform access");
  });

  it("does not treat an unscoped Members invitation as this person's invite", () => {
    const access = resolvePersonPlatformAccess({
      linkedUserId: null,
      members: [],
      invitations: [
        {
          id: "other",
          partyProfileId: null,
          accepted: false,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
      partyId,
    });
    expect(access.status).toBe("NOT_INVITED");
  });

  it("does not treat another person's invitation as this person's access", () => {
    const access = resolvePersonPlatformAccess({
      linkedUserId: null,
      members: [],
      invitations: [
        {
          id: "other-party",
          partyProfileId: "party-2",
          accepted: false,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
      partyId,
    });
    expect(access.status).toBe("NOT_INVITED");
  });
});

describe("isMemberWithoutCompanyRole", () => {
  it("keeps members who are not linked to a party profile", () => {
    const linked = linkedPartyUserIds([{ userId: "AAAAA" }, { userId: null }]);
    expect(isMemberWithoutCompanyRole("BBBBB", linked)).toBe(true);
    expect(isMemberWithoutCompanyRole("AAAAA", linked)).toBe(false);
  });
});
