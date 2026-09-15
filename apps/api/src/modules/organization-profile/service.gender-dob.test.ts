import { OrganizationType } from "@prisma/client";
import { patchOrgMasterProfile } from "./service";

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
    corporate_onboarding_data: null,
    date_of_commencement: null,
    phone_number: null,
    gender: "MALE",
    date_of_birth: new Date("1990-01-01T00:00:00.000Z"),
    nationality: "MALAYSIA",
    ...overrides,
  };
}

describe("personal investor master-profile patch (gender, dateOfBirth)", () => {
  beforeEach(() => {
    mockInvestorFindUnique.mockReset();
    mockInvestorUpdate.mockReset();
    mockInvestorUpdate.mockResolvedValue({});
  });

  it("overwrites gender even when fill-empty-only is true", async () => {
    mockInvestorFindUnique.mockResolvedValue(personalOrg({ gender: "MALE" }));

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-1",
      actorUserId: "user-1",
      source: "USER",
      fillEmptyOnly: true,
      patch: { gender: "FEMALE" },
    });

    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gender: "FEMALE" }),
      })
    );
  });

  it("overwrites dateOfBirth even when fill-empty-only is true", async () => {
    mockInvestorFindUnique.mockResolvedValue(personalOrg({ date_of_birth: new Date("1990-01-01T00:00:00.000Z") }));

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-1",
      actorUserId: "user-1",
      source: "USER",
      fillEmptyOnly: true,
      patch: { dateOfBirth: "2026-09-16" },
    });

    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          date_of_birth: new Date("2026-09-16T00:00:00.000Z"),
        }),
      })
    );
  });

  it("overwrites both gender and dateOfBirth together", async () => {
    mockInvestorFindUnique.mockResolvedValue(personalOrg({ gender: "MALE" }));

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "inv-1",
      actorUserId: "user-1",
      source: "USER",
      fillEmptyOnly: true,
      patch: { gender: "FEMALE", dateOfBirth: "2026-09-16" },
    });

    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gender: "FEMALE",
          date_of_birth: new Date("2026-09-16T00:00:00.000Z"),
        }),
      })
    );
  });
});

