import { OrganizationPartyMembershipStatus } from "@prisma/client";
import { planRegTankPersonSeed } from "./regtank-party-seed";

const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";

function current(overrides: Record<string, unknown> = {}) {
  return {
    id: "party-1",
    party_key: generatedKey,
    name: "Pre Id",
    email: "preid@example.com",
    identity_number: null as string | null,
    identity_prefix: null as string | null,
    gender: null as string | null,
    date_of_birth: null as Date | null,
    nationality: null as string | null,
    field_sources: { name: { source: "USER", updatedAt: "2026-09-01T00:00:00.000Z" } },
    entity_type: "INDIVIDUAL",
    ...overrides,
  };
}

const seed = {
  name: "Ahmad Ali",
  identityNumber: "900101-10-1234",
  identityPrefix: null as "PASSPORT" | null,
  gender: "MALE" as const,
  dateOfBirth: "1990-01-01",
  nationality: "MALAYSIA",
};

describe("planRegTankPersonSeed", () => {
  it("seeds empty identity and confirmed profile fields without changing party_key or email", () => {
    const planned = planRegTankPersonSeed({ current: current(), seed, otherRows: [] });
    expect(planned.wrote).toBe(true);
    expect(planned.data.identity_number).toBe("900101101234");
    expect(planned.data.gender).toBe("MALE");
    expect(planned.data.nationality).toBe("MALAYSIA");
    expect(planned.data.date_of_birth).toEqual(new Date("1990-01-01T00:00:00.000Z"));
    expect(planned.data.name).toBeUndefined();
    expect(planned.data.party_key).toBeUndefined();
    expect(planned.data.email).toBeUndefined();
    expect(planned.identityCollision).toBeNull();
    expect(planned.sources.identityNumber?.source).toBe("REGTANK");
    expect(planned.sources.name?.source).toBe("USER");
  });

  it("sets PASSPORT prefix and leaves IDENTITY prefix empty", () => {
    const passport = planRegTankPersonSeed({
      current: current(),
      seed: { ...seed, identityPrefix: "PASSPORT" },
      otherRows: [],
    });
    expect(passport.data.identity_prefix).toBe("PASSPORT");
    const identity = planRegTankPersonSeed({
      current: current(),
      seed: { ...seed, identityPrefix: null },
      otherRows: [],
    });
    expect(identity.data.identity_prefix).toBeUndefined();
  });

  it("does not overwrite existing USER/ADMIN/CTOS values", () => {
    const planned = planRegTankPersonSeed({
      current: current({
        identity_number: "880101011111",
        gender: "FEMALE",
        field_sources: {
          name: { source: "USER", updatedAt: "2026-09-01T00:00:00.000Z" },
          identityNumber: { source: "CTOS", updatedAt: "2026-09-01T00:00:00.000Z" },
          gender: { source: "ADMIN", updatedAt: "2026-09-01T00:00:00.000Z" },
        },
      }),
      seed,
      otherRows: [],
    });
    expect(planned.data.identity_number).toBeUndefined();
    expect(planned.data.gender).toBeUndefined();
    expect(planned.sources.identityNumber?.source).toBe("CTOS");
  });

  it("stores a collision instead of seeding when another MASTER_ACTIVE Person has the identity", () => {
    const planned = planRegTankPersonSeed({
      current: current(),
      seed,
      otherRows: [
        {
          id: "other-1",
          party_key: "900101101234",
          identity_number: "900101101234",
          entity_type: "INDIVIDUAL",
          membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
        },
      ],
    });
    expect(planned.data.identity_number).toBeUndefined();
    expect(planned.identityCollision).toMatchObject({
      status: "BLOCKED",
      canonicalIdentity: "900101101234",
      otherPartyId: "other-1",
      otherMembershipStatus: "MASTER_ACTIVE",
      source: "REGTANK_QUERY",
    });
  });

  it("stores a collision instead of seeding when an EXTERNAL_OBSERVED Person has the identity", () => {
    const planned = planRegTankPersonSeed({
      current: current(),
      seed,
      otherRows: [
        {
          id: "obs-1",
          party_key: "900101101234",
          identity_number: "900101-10-1234",
          entity_type: "INDIVIDUAL",
          membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        },
      ],
    });
    expect(planned.data.identity_number).toBeUndefined();
    expect(planned.identityCollision?.otherPartyId).toBe("obs-1");
    expect(planned.identityCollision?.otherMembershipStatus).toBe("EXTERNAL_OBSERVED");
  });

  it("ignores self when checking collisions", () => {
    const planned = planRegTankPersonSeed({
      current: current({ identity_number: null }),
      seed,
      otherRows: [
        {
          id: "party-1",
          party_key: generatedKey,
          identity_number: null,
          entity_type: "INDIVIDUAL",
          membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
        },
      ],
    });
    expect(planned.identityCollision).toBeNull();
    expect(planned.data.identity_number).toBe("900101101234");
  });
});
