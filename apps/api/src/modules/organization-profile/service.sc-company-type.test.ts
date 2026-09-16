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

describe("scCompanyType shared master field", () => {
  beforeEach(() => {
    mockIssuerFindUnique.mockReset();
    mockIssuerUpdate.mockReset();
    mockInvestorFindUnique.mockReset();
    mockInvestorUpdate.mockReset();

    mockInvestorUpdate.mockResolvedValue({});
    mockIssuerUpdate.mockResolvedValue({});
  });

  function issuerCompanyOrg(overrides: Record<string, unknown> = {}) {
    return {
      id: "iss-1",
      type: OrganizationType.COMPANY,
      sc_company_type: null,
      profile_field_sources: {},
      date_of_incorporation: null,
      date_of_commencement: null,
      country_of_incorporation: null,
      phone_number: null,
      name: "Issuer Co",
      corporate_onboarding_data: null,
      // Fields below are referenced by other branches depending on patch keys.
      corporate_entities: null,
      company_category: null,
      sc_investor_category: null,
      residential_address: null,
      gender: null,
      nationality: null,
      date_of_birth: null,
      business_aml_status: null,
      is_sophisticated_investor: null,
      sophisticated_investor_reason: null,
      regtank_onboarding: [],
      owner_user_id: "user-1",
      display_reference: "REF",
      onboarding_status: "COMPLETED",
      created_at: new Date(),
      updated_at: new Date(),
      onboarding_fee_paid_at: null,
      regulatory_structure_established_at: null,
      ...overrides,
    };
  }

  function investorCompanyOrg(overrides: Record<string, unknown> = {}) {
    return {
      id: "inv-co-1",
      type: OrganizationType.COMPANY,
      sc_company_type: null,
      sc_investor_category: null,
      is_sophisticated_investor: false,
      sophisticated_investor_reason: null,
      profile_field_sources: {},
      date_of_incorporation: null,
      country_of_incorporation: null,
      corporate_onboarding_data: null,
      residential_address: null,
      gender: "MALE",
      nationality: "Malaysia",
      phone_number: null,
      date_of_birth: null,
      // Fields below ensure other branches don't break if they run.
      corporate_entities: null,
      investor_balance: null,
      name: "Investor Co",
      date_of_commencement: null,
      company_category: null,
      regtank_onboarding: [],
      owner_user_id: "user-1",
      display_reference: "REF",
      onboarding_status: "COMPLETED",
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  it("persists scCompanyType for a corporate investor portal", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      investorCompanyOrg({ sc_company_type: null, sc_investor_category: null })
    );

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-co-1",
      actorUserId: "admin-1",
      source: "USER",
      patch: { scCompanyType: "PRIVATE_LIMITED" },
    });

    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-co-1" },
        data: expect.objectContaining({ sc_company_type: "PRIVATE_LIMITED" }),
      })
    );
  });

  it("continues to persist scCompanyType for issuer portal (regression)", async () => {
    mockIssuerFindUnique.mockResolvedValue(
      issuerCompanyOrg({ sc_company_type: null })
    );

    await patchOrgMasterProfile({
      portal: "issuer",
      organizationId: "iss-1",
      actorUserId: "admin-1",
      source: "USER",
      patch: { scCompanyType: "PUBLIC_LIMITED" },
    });

    expect(mockIssuerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "iss-1" },
        data: expect.objectContaining({ sc_company_type: "PUBLIC_LIMITED" }),
      })
    );
  });
});

