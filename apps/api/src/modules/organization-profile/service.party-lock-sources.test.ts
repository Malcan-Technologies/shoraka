import { Prisma } from "@prisma/client";
import { OrganizationPartyMembershipStatus, OrganizationPartyOrigin } from "@prisma/client";
import { patchPartyProfile } from "./service";

const mockPartyFindFirst = jest.fn();
const mockPartyUpdate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
      update: (...args: unknown[]) => mockPartyUpdate(...args),
    },
  },
}));

function baseParty(params: {
  dateOfBirth: Date | null;
  fieldSources: Record<string, unknown>;
  identityNumber: string | null;
}): any {
  return {
    id: "p-a",
    party_key: "800101011234",
    issuer_organization_id: "org-1",
    investor_organization_id: null,
    origin: OrganizationPartyOrigin.REGTANK_PARTY,
    membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
    entity_type: "INDIVIDUAL",
    absent_from_latest_external: false,
    name: "Alice Tan",
    email: null,
    salutation: null,
    identity_prefix: "NRIC",
    identity_number: params.identityNumber,
    date_of_birth: params.dateOfBirth,
    date_of_incorporation: null,
    gender: "MALE",
    nationality: "MALAYSIA",
    country_of_incorporation: null,
    address: null,
    is_director: false,
    is_shareholder: true,
    is_board: false,
    is_management: false,
    share_type: null,
    share_type_other: null,
    shareholding_units: null,
    shareholding_amount: null,
    shareholding_percentage: new Prisma.Decimal("20"),
    designation: null,
    designation_other: null,
    appointment_date: null,
    resignation_date: null,
    field_sources: params.fieldSources,
    external_observation: null,
    created_at: new Date(),
    updated_at: new Date(),
    user_id: null,
    user: null,
  };
}

describe("party profile lock decisions by field_sources.source", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const portals: Array<"issuer" | "investor"> = ["issuer", "investor"];

  it.each(portals)("locks RegTank DOB when editing as USER (%s portal)", async (portal) => {
    const row = baseParty({
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      identityNumber: "800101011234",
      fieldSources: {
        dateOfBirth: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });
    mockPartyFindFirst.mockResolvedValue(row);
    mockPartyUpdate.mockResolvedValue(row);

    await expect(
      patchPartyProfile({
        portal,
        organizationId: "org-1",
        partyId: "p-a",
        source: "USER",
        fillEmptyOnly: true,
        patch: { dateOfBirth: "1991-01-01" },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
  });

  it.each(portals)("allows USER DOB edits when field source is USER (%s portal)", async (portal) => {
    const row = baseParty({
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      identityNumber: "800101011234",
      fieldSources: {
        dateOfBirth: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });
    mockPartyFindFirst.mockResolvedValue(row);
    mockPartyUpdate.mockImplementation(async (args: any) => {
      const data = args.data;
      return {
        ...row,
        date_of_birth: data.date_of_birth,
        field_sources: data.field_sources,
      };
    });

    await patchPartyProfile({
      portal,
      organizationId: "org-1",
      partyId: "p-a",
      source: "USER",
      fillEmptyOnly: true,
      patch: { dateOfBirth: "1991-01-01" },
    });

    const next = mockPartyUpdate.mock.calls[0]?.[0]?.data;
    expect(next).toMatchObject({
      date_of_birth: new Date("1991-01-01T00:00:00.000Z"),
    });
    expect((next.field_sources as any)?.dateOfBirth?.source).toBe("USER");
  });

  it.each(portals)("allows USER DOB edits when field source is ADMIN (%s portal)", async (portal) => {
    const row = baseParty({
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      identityNumber: "800101011234",
      fieldSources: {
        dateOfBirth: { source: "ADMIN", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });
    mockPartyFindFirst.mockResolvedValue(row);
    mockPartyUpdate.mockImplementation(async (args: any) => {
      const data = args.data;
      return {
        ...row,
        date_of_birth: data.date_of_birth,
        field_sources: data.field_sources,
      };
    });

    await patchPartyProfile({
      portal,
      organizationId: "org-1",
      partyId: "p-a",
      source: "USER",
      fillEmptyOnly: true,
      patch: { dateOfBirth: "1991-01-01" },
    });

    const next = mockPartyUpdate.mock.calls[0]?.[0]?.data;
    expect(next.date_of_birth).toEqual(new Date("1991-01-01T00:00:00.000Z"));
    expect((next.field_sources as any)?.dateOfBirth?.source).toBe("USER");
  });

  it.each(portals)("locks RegTank identity number (%s portal)", async (portal) => {
    const row = baseParty({
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      identityNumber: "800101011234",
      fieldSources: {
        identityNumber: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });
    mockPartyFindFirst.mockResolvedValue(row);
    mockPartyUpdate.mockResolvedValue(row);

    await expect(
      patchPartyProfile({
        portal,
        organizationId: "org-1",
        partyId: "p-a",
        source: "USER",
        fillEmptyOnly: true,
        patch: { identityNumber: "800101011999" },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
  });

  it.each(portals)("allows identity number edits when field source is USER (%s portal)", async (portal) => {
    const row = baseParty({
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      identityNumber: "800101011234",
      fieldSources: {
        identityNumber: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });
    mockPartyFindFirst.mockResolvedValue(row);
    mockPartyUpdate.mockImplementation(async (args: any) => {
      const data = args.data;
      return {
        ...row,
        identity_number: data.identity_number,
        field_sources: data.field_sources,
      };
    });

    await patchPartyProfile({
      portal,
      organizationId: "org-1",
      partyId: "p-a",
      source: "USER",
      fillEmptyOnly: true,
      patch: { identityNumber: "800101011999" },
    });

    const next = mockPartyUpdate.mock.calls[0]?.[0]?.data;
    expect(next.identity_number).toBe("800101011999");
    expect((next.field_sources as any)?.identityNumber?.source).toBe("USER");
  });

  it.each(portals)("allows identity number edits when field source is ADMIN (%s portal)", async (portal) => {
    const row = baseParty({
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      identityNumber: "800101011234",
      fieldSources: {
        identityNumber: { source: "ADMIN", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });
    mockPartyFindFirst.mockResolvedValue(row);
    mockPartyUpdate.mockImplementation(async (args: any) => {
      const data = args.data;
      return {
        ...row,
        identity_number: data.identity_number,
        field_sources: data.field_sources,
      };
    });

    await patchPartyProfile({
      portal,
      organizationId: "org-1",
      partyId: "p-a",
      source: "USER",
      fillEmptyOnly: true,
      patch: { identityNumber: "800101011999" },
    });

    const next = mockPartyUpdate.mock.calls[0]?.[0]?.data;
    expect(next.identity_number).toBe("800101011999");
    expect((next.field_sources as any)?.identityNumber?.source).toBe("USER");
  });
});

