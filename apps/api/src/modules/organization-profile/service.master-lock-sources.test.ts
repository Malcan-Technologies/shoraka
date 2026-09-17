import { OrganizationType } from "@prisma/client";
import { patchOrgMasterProfile } from "./service";

const mockIssuerFindUnique = jest.fn();
const mockIssuerUpdate = jest.fn();
const mockInvestorFindUnique = jest.fn();
const mockInvestorUpdate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
      update: (...args: unknown[]) => mockIssuerUpdate(...args),
    },
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
      update: (...args: unknown[]) => mockInvestorUpdate(...args),
    },
  },
}));

function personalOrg(params: {
  portal: "issuer" | "investor";
  dateOfBirth: Date | null;
  profileFieldSources: Record<string, unknown>;
}) {
  return {
    id: "org-1",
    type: OrganizationType.PERSONAL,
    // These are referenced by patchOrgMasterProfile applyScalar calls.
    date_of_birth: params.dateOfBirth,
    gender: "MALE",
    nationality: "MALAYSIA",
    profile_field_sources: params.profileFieldSources,
    corporate_onboarding_data: null,
    residential_address: null,
    corporate_entities: null,
    date_of_incorporation: null,
    country_of_incorporation: null,
    sc_company_type: null,
    sc_investor_category: null,
    is_sophisticated_investor: false,
    phone_number: null,
    name: "Org Name",
    address: null,
    // ensure fields accessed by other code paths exist
    onboardedAt: null,
  } as any;
}

describe("master-profile lock decisions by profile_field_sources.source", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIssuerUpdate.mockResolvedValue({});
    mockInvestorUpdate.mockResolvedValue({});
  });

  const portals: Array<"issuer" | "investor"> = ["issuer", "investor"];

  it.each(portals)("locks RegTank DOB for USER patch (%s portal)", async (portal) => {
    const row = personalOrg({
      portal,
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      profileFieldSources: {
        dateOfBirth: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });

    if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
    else mockInvestorFindUnique.mockResolvedValue(row);

    await expect(
      patchOrgMasterProfile({
        portal,
        organizationId: "org-1",
        actorUserId: "user-1",
        source: "USER",
        fillEmptyOnly: true,
        patch: { dateOfBirth: "1991-01-01" },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
  });

  it.each(portals)("allows USER DOB edits when field source is USER (%s portal)", async (portal) => {
    const row = personalOrg({
      portal,
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      profileFieldSources: {
        dateOfBirth: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });

    if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
    else mockInvestorFindUnique.mockResolvedValue(row);

    await patchOrgMasterProfile({
      portal,
      organizationId: "org-1",
      actorUserId: "user-1",
      source: "USER",
      fillEmptyOnly: true,
      patch: { dateOfBirth: "1991-01-01" },
    });

    const updateCall = portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
    expect(updateCall?.data?.date_of_birth).toEqual(new Date("1991-01-01T00:00:00.000Z"));
  });

  it.each(portals)("allows USER DOB edits when field source is ADMIN (%s portal)", async (portal) => {
    const row = personalOrg({
      portal,
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      profileFieldSources: {
        dateOfBirth: { source: "ADMIN", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });

    if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
    else mockInvestorFindUnique.mockResolvedValue(row);

    await patchOrgMasterProfile({
      portal,
      organizationId: "org-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      fillEmptyOnly: true,
      patch: { dateOfBirth: "1991-01-01" },
    });

    const updateCall = portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
    expect(updateCall?.data?.date_of_birth).toEqual(new Date("1991-01-01T00:00:00.000Z"));
  });
});

