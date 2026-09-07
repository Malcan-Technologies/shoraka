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
    mockInvestorFindUnique.mockResolvedValue(corporateOrg());
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
    mockInvestorFindUnique.mockResolvedValue(corporateOrg());
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

  it("lets Admin update the same persisted field without changing is_sophisticated_investor", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalOrg({ sc_investor_category: "RETAIL", is_sophisticated_investor: false })
    );
    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      patch: { scInvestorCategory: "SOPHISTICATED_ACCREDITED" },
    });
    const data = mockInvestorUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.sc_investor_category).toBe("SOPHISTICATED_ACCREDITED");
    expect(data).not.toHaveProperty("is_sophisticated_investor");
  });
});
