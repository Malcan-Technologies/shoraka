import { OrganizationType } from "@prisma/client";
import { patchOrgMasterProfile } from "./service";
import { buildInvestorProfileCompleteness } from "@cashsouk/types";

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
  gender?: string | null;
  nationality?: string | null;
  documentNumber: string | null;
  profileFieldSources: Record<string, unknown>;
}) {
  return {
    id: "org-1",
    type: OrganizationType.PERSONAL,
    // These are referenced by patchOrgMasterProfile applyScalar calls.
    date_of_birth: params.dateOfBirth,
    gender: params.gender === undefined ? "MALE" : params.gender,
    nationality: params.nationality === undefined ? "MALAYSIA" : params.nationality,
    document_type: "DRIVER_LICENSE",
    document_number: params.documentNumber,
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

  // Identity/document number editor is only implemented for the Personal Investor portal.
  const portals: Array<"issuer" | "investor"> = ["investor"];

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

  it("allows USER to overwrite an already-filled residential State", async () => {
    const row = personalOrg({
      portal: "investor",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      documentNumber: "800101011234",
      profileFieldSources: {},
    });
    row.residential_address = { state: "Sarawak", postalCode: "12345" };
    mockInvestorFindUnique.mockResolvedValue(row);

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "org-1",
      actorUserId: "user-1",
      source: "USER",
      fillEmptyOnly: true,
      patch: { residentialAddress: { state: "Selangor", postalCode: "47800" } },
    });

    expect(mockInvestorUpdate.mock.calls[0]?.[0]?.data?.residential_address).toEqual(
      expect.objectContaining({
        state: "Selangor",
        postalCode: "47800",
      })
    );
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

  it.each(portals)(
    "allows ADMIN identityNumber edits when RegTank source but identityNumber is missing (%s portal)",
    async (portal) => {
      const nextIdentity = "800101011234";
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: null,
        profileFieldSources: {
          identityNumber: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      const before = buildInvestorProfileCompleteness({
        organizationType: "PERSONAL",
        personal: {
          name: "Org Name",
          identityPrefix: "NRIC",
          identityNumber: null,
          dateOfBirth: "1990-01-01",
          gender: "MALE",
          state: "Selangor",
          postalCode: "47300",
          nationality: "Malaysia",
          scInvestorCategory: "RETAIL",
          isSophisticatedInvestor: false,
        },
      });
      expect(before.missing.some((m) => m.field === "identityNumber")).toBe(true);

      await patchOrgMasterProfile({
        portal,
        organizationId: "org-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { identityNumber: nextIdentity, documentNumber: undefined } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.document_number).toEqual(nextIdentity);
      expect((updateCall?.data?.profile_field_sources as any)?.identityNumber?.source).toBe("ADMIN");

      const after = buildInvestorProfileCompleteness({
        organizationType: "PERSONAL",
        personal: {
          name: "Org Name",
          identityPrefix: "NRIC",
          identityNumber: nextIdentity,
          dateOfBirth: "1990-01-01",
          gender: "MALE",
          state: "Selangor",
          postalCode: "47300",
          nationality: "Malaysia",
          scInvestorCategory: "RETAIL",
          isSophisticatedInvestor: false,
        },
      });
      expect(after.missing.some((m) => m.field === "identityNumber")).toBe(false);
    }
  );

  it.each(portals)(
    "rejects ADMIN identityNumber edits when RegTank source and identityNumber is already present (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: "800101011234",
        profileFieldSources: {
          identityNumber: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      await expect(
        patchOrgMasterProfile({
          portal,
          organizationId: "org-1",
          actorUserId: "admin-1",
          source: "ADMIN",
          patch: { identityNumber: "800101011999" } as any,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    }
  );

  it.each(portals)(
    "allows ADMIN identityNumber edits when source is USER (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: "800101011234",
        profileFieldSources: {
          identityNumber: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      await patchOrgMasterProfile({
        portal,
        organizationId: "org-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { identityNumber: "800101011999" } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.document_number).toEqual("800101011999");
    }
  );

  it.each(portals)(
    "clears identityNumber to null for ADMIN (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: "800101011234",
        profileFieldSources: {
          identityNumber: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      const before = buildInvestorProfileCompleteness({
        organizationType: "PERSONAL",
        personal: {
          name: "Org Name",
          identityPrefix: "NRIC",
          identityNumber: "800101011234",
          dateOfBirth: "1990-01-01",
          gender: "MALE",
          state: "Selangor",
          postalCode: "47300",
          nationality: "Malaysia",
          scInvestorCategory: "RETAIL",
          isSophisticatedInvestor: false,
        },
      });
      expect(before.missing.some((m) => m.field === "identityNumber")).toBe(false);

      await patchOrgMasterProfile({
        portal,
        organizationId: "org-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { identityNumber: null } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.document_number).toBeNull();
      expect((updateCall?.data?.profile_field_sources as any)?.identityNumber?.source).toBe("ADMIN");

      const after = buildInvestorProfileCompleteness({
        organizationType: "PERSONAL",
        personal: {
          name: "Org Name",
          identityPrefix: "NRIC",
          identityNumber: null,
          dateOfBirth: "1990-01-01",
          gender: "MALE",
          state: "Selangor",
          postalCode: "47300",
          nationality: "Malaysia",
          scInvestorCategory: "RETAIL",
          isSophisticatedInvestor: false,
        },
      });
      expect(after.missing.some((m) => m.field === "identityNumber")).toBe(true);
    }
  );

  it.each(portals)(
    "rejects ADMIN clearing identityNumber when it is REGTANK-locked (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: "800101011234",
        profileFieldSources: {
          identityNumber: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      await expect(
        patchOrgMasterProfile({
          portal,
          organizationId: "org-1",
          actorUserId: "admin-1",
          source: "ADMIN",
          patch: { identityNumber: null } as any,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    }
  );

  it.each(portals)(
    "omitted identityNumber means no change (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: "800101011234",
        profileFieldSources: {
          identityNumber: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      await patchOrgMasterProfile({
        portal,
        organizationId: "org-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: {} as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.document_number).toBeUndefined();
      expect((updateCall?.data?.profile_field_sources as any)?.identityNumber?.source).toBe("USER");
    }
  );

  it.each(portals)(
    "allows USER dateOfBirth edits when RegTank source but DOB is missing (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: null,
        profileFieldSources: {
          dateOfBirth: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
        documentNumber: null,
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

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.date_of_birth).toEqual(new Date("1991-01-01T00:00:00.000Z"));
      expect((updateCall?.data?.profile_field_sources as any)?.dateOfBirth?.source).toBe("USER");
    }
  );

  it.each(portals)(
    "locks RegTank DOB for ADMIN patch (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        profileFieldSources: {
          dateOfBirth: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
        documentNumber: null,
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      await expect(
        patchOrgMasterProfile({
          portal,
          organizationId: "org-1",
          actorUserId: "admin-1",
          source: "ADMIN",
          patch: { dateOfBirth: "1992-01-01" },
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    }
  );

  it.each(portals)(
    "locks RegTank gender for USER patch (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        gender: "MALE",
        nationality: "MALAYSIA",
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: null,
        profileFieldSources: {
          gender: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
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
          patch: { gender: "FEMALE" } as any,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    }
  );

  it.each(portals)(
    "allows USER gender edits when field source is USER (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        gender: "MALE",
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: null,
        profileFieldSources: {
          gender: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
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
        patch: { gender: "FEMALE" } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.gender).toEqual("FEMALE");
      expect((updateCall?.data?.profile_field_sources as any)?.gender?.source).toBe("USER");
    }
  );

  it.each(portals)(
    "locks RegTank nationality for USER patch (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        nationality: "MALAYSIA",
        documentNumber: null,
        profileFieldSources: {
          nationality: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
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
          patch: { nationality: "SINGAPORE" } as any,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    }
  );

  it.each(portals)(
    "allows USER nationality edits when field source is USER (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        nationality: "MALAYSIA",
        documentNumber: null,
        profileFieldSources: {
          nationality: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
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
        patch: { nationality: "SINGAPORE" } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.nationality).toEqual("SINGAPORE");
      expect((updateCall?.data?.profile_field_sources as any)?.nationality?.source).toBe("USER");
    }
  );

  it.each(portals)(
    "allows USER gender edits when RegTank source but gender is missing (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        gender: null,
        documentNumber: null,
        profileFieldSources: {
          gender: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
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
        patch: { gender: "FEMALE" } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.gender).toEqual("FEMALE");
      expect((updateCall?.data?.profile_field_sources as any)?.gender?.source).toBe("USER");
    }
  );

  it.each(portals)(
    "allows USER nationality edits when RegTank source but nationality is missing (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        nationality: null,
        documentNumber: null,
        profileFieldSources: {
          nationality: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
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
        patch: { nationality: "SINGAPORE" } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.nationality).toEqual("SINGAPORE");
      expect((updateCall?.data?.profile_field_sources as any)?.nationality?.source).toBe("USER");
    }
  );

  it.each(portals)(
    "allows ADMIN dateOfBirth edits when field source is ADMIN (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: null,
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
        patch: { dateOfBirth: "1991-01-01" },
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.date_of_birth).toEqual(new Date("1991-01-01T00:00:00.000Z"));
      expect((updateCall?.data?.profile_field_sources as any)?.dateOfBirth?.source).toBe("ADMIN");
    }
  );

  it.each(portals)(
    "locks RegTank gender for ADMIN patch (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        gender: "MALE",
        documentNumber: null,
        profileFieldSources: {
          gender: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      await expect(
        patchOrgMasterProfile({
          portal,
          organizationId: "org-1",
          actorUserId: "admin-1",
          source: "ADMIN",
          patch: { gender: "FEMALE" } as any,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    }
  );

  it.each(portals)(
    "locks RegTank nationality for ADMIN patch (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        nationality: "MALAYSIA",
        documentNumber: null,
        profileFieldSources: {
          nationality: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      });

      if (portal === "issuer") mockIssuerFindUnique.mockResolvedValue(row);
      else mockInvestorFindUnique.mockResolvedValue(row);

      await expect(
        patchOrgMasterProfile({
          portal,
          organizationId: "org-1",
          actorUserId: "admin-1",
          source: "ADMIN",
          patch: { nationality: "SINGAPORE" } as any,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    }
  );

  it.each(portals)(
    "allows USER identityNumber edits when RegTank source but identityNumber is missing (%s portal)",
    async (portal) => {
      const nextIdentity = "800101011234";
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: null,
        profileFieldSources: {
          identityNumber: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
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
        patch: { identityNumber: nextIdentity } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.document_number).toEqual(nextIdentity);
      expect((updateCall?.data?.profile_field_sources as any)?.identityNumber?.source).toBe("USER");
    }
  );

  it.each(portals)(
    "allows USER identityNumber edits when field source is USER (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: "800101011234",
        profileFieldSources: {
          identityNumber: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
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
        patch: { identityNumber: "800101011999" } as any,
      });

      const updateCall =
        portal === "issuer" ? mockIssuerUpdate.mock.calls[0]?.[0] : mockInvestorUpdate.mock.calls[0]?.[0];
      expect(updateCall?.data?.document_number).toEqual("800101011999");
      expect((updateCall?.data?.profile_field_sources as any)?.identityNumber?.source).toBe("USER");
    }
  );

  it.each(portals)(
    "rejects USER identityNumber edits when RegTank source and identityNumber is already present (%s portal)",
    async (portal) => {
      const row = personalOrg({
        portal,
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        documentNumber: "800101011234",
        profileFieldSources: {
          identityNumber: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
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
          patch: { identityNumber: "800101011999" } as any,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    }
  );
});

