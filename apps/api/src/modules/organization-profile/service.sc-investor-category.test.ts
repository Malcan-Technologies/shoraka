const mockInvestorFindUnique = jest.fn();
const mockInvestorUpdate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: { findUnique: jest.fn(), update: jest.fn() },
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
      update: (...args: unknown[]) => mockInvestorUpdate(...args),
    },
  },
}));

import { OrganizationType } from "@prisma/client";
import { patchOrgMasterProfile } from "./service";

function personalOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    type: OrganizationType.PERSONAL,
    sc_investor_category: null,
    is_sophisticated_investor: false,
    profile_field_sources: {},
    date_of_incorporation: null,
    country_of_incorporation: null,
    residential_address: null,
    gender: "MALE",
    nationality: "Malaysia",
    phone_number: null,
    corporate_onboarding_data: null,
    ...overrides,
  };
}

function corporateOrg(overrides: Record<string, unknown> = {}) {
  return personalOrg({
    id: "inv-co-1",
    type: OrganizationType.COMPANY,
    ...overrides,
  });
}

describe("sc_investor_category shared master field", () => {
  beforeEach(() => {
    mockInvestorFindUnique.mockReset();
    mockInvestorUpdate.mockReset();
    mockInvestorUpdate.mockResolvedValue({});
  });

  it("lets a personal investor PATCH a personal SC category even when fill-empty-only", async () => {
    mockInvestorFindUnique.mockResolvedValue(personalOrg({ sc_investor_category: "RETAIL" }));
    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-1",
      actorUserId: "user-1",
      source: "USER",
      fillEmptyOnly: true,
      patch: { scInvestorCategory: "ANGEL" },
    });
    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sc_investor_category: "ANGEL" }),
      })
    );
  });

  it("lets a corporate investor PATCH a corporate SC category", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      corporateOrg({ is_sophisticated_investor: false, sc_investor_category: null })
    );
    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-co-1",
      actorUserId: "user-1",
      source: "USER",
      fillEmptyOnly: true,
      patch: { scInvestorCategory: "NON_SOPHISTICATED_ENTITY" },
    });
    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sc_investor_category: "NON_SOPHISTICATED_ENTITY" }),
      })
    );
  });

  it("rejects a corporate-only category on a personal investor", async () => {
    mockInvestorFindUnique.mockResolvedValue(personalOrg());
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-1",
        actorUserId: "user-1",
        source: "USER",
        fillEmptyOnly: true,
        patch: { scInvestorCategory: "NON_SOPHISTICATED_ENTITY" },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("rejects a personal-only category on a corporate investor", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      corporateOrg({ is_sophisticated_investor: true })
    );
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-co-1",
        actorUserId: "user-1",
        source: "USER",
        fillEmptyOnly: true,
        patch: { scInvestorCategory: "ANGEL" },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("rejects personal Sophisticated Yes with Retail", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalOrg({ is_sophisticated_investor: true, sc_investor_category: null })
    );
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-1",
        actorUserId: "user-1",
        source: "USER",
        patch: { scInvestorCategory: "RETAIL" },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "This Type of Investor is not valid for this organisation.",
    });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("rejects personal Sophisticated No with HNWI", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalOrg({ is_sophisticated_investor: false, sc_investor_category: "RETAIL" })
    );
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { scInvestorCategory: "SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL" },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("rejects company Yes + Retail/Angel and company No + HNWE/Accredited", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      corporateOrg({ is_sophisticated_investor: true, sc_investor_category: null })
    );
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-co-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { scInvestorCategory: "RETAIL" },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-co-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { scInvestorCategory: "ANGEL" },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });

    mockInvestorFindUnique.mockResolvedValue(
      corporateOrg({ is_sophisticated_investor: false, sc_investor_category: null })
    );
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-co-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { scInvestorCategory: "SOPHISTICATED_HIGH_NET_WORTH_ENTITY" },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-co-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { scInvestorCategory: "SOPHISTICATED_ACCREDITED" },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("does not auto-set Type of Investor when company Sophisticated is saved", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      corporateOrg({ is_sophisticated_investor: null, sc_investor_category: null })
    );
    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-co-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      patch: { isSophisticatedInvestor: false },
    });
    const data = mockInvestorUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.is_sophisticated_investor).toBe(false);
    expect(data).not.toHaveProperty("sc_investor_category");
  });

  it("does not mark a company sophisticated when Type of Investor is saved", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      corporateOrg({ is_sophisticated_investor: false, sc_investor_category: null })
    );
    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-co-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      patch: { scInvestorCategory: "NON_SOPHISTICATED_ENTITY" },
    });
    const data = mockInvestorUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.sc_investor_category).toBe("NON_SOPHISTICATED_ENTITY");
    expect(data).not.toHaveProperty("is_sophisticated_investor");
  });

  it("rejects Type of Investor when Sophisticated Investor has not been chosen", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      corporateOrg({ is_sophisticated_investor: null, sc_investor_category: null })
    );
    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "inv-co-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { scInvestorCategory: "NON_SOPHISTICATED_ENTITY" },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Select Sophisticated Investor first.",
    });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("clears Type of Investor when Sophisticated status makes it invalid", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalOrg({
        is_sophisticated_investor: true,
        sc_investor_category: "SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL",
      })
    );
    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      patch: { isSophisticatedInvestor: false },
    });
    const data = mockInvestorUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.is_sophisticated_investor).toBe(false);
    expect(data.sc_investor_category).toBeNull();
  });

  it("lets Admin update Type of Investor without changing is_sophisticated_investor", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalOrg({ sc_investor_category: "RETAIL", is_sophisticated_investor: false })
    );
    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      patch: { scInvestorCategory: "ANGEL" },
    });
    const data = mockInvestorUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.sc_investor_category).toBe("ANGEL");
    expect(data).not.toHaveProperty("is_sophisticated_investor");
  });

  it("preserves an existing valid Type of Investor when another field is patched", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalOrg({
        sc_investor_category: "SOPHISTICATED_ACCREDITED",
        is_sophisticated_investor: true,
        nationality: "Malaysia",
      })
    );
    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      patch: { nationality: "Singapore" },
    });
    const data = mockInvestorUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty("sc_investor_category");
    expect(data.nationality).toBe("Singapore");
  });
});
