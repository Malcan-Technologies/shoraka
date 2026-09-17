import { OrganizationType } from "@prisma/client";
import { patchOrgMasterProfile } from "./service";
import { buildInvestorProfileCompleteness, personalInvestorIdentityFormatKind } from "@cashsouk/types";

const mockInvestorFindUnique = jest.fn();
const mockInvestorUpdate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
      update: (...args: unknown[]) => mockInvestorUpdate(...args),
    },
  },
}));

const invalid = "a0000000000&*";
const valid12 = "800101011234";

function personalInvestor(params: { documentType: string; documentNumber: string | null }) {
  return {
    id: "org-1",
    type: OrganizationType.PERSONAL,
    date_of_birth: new Date("1990-01-01T00:00:00.000Z"),
    gender: "MALE",
    nationality: "MALAYSIA",
    document_type: params.documentType,
    document_number: params.documentNumber,
    profile_field_sources: {
      identityNumber: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
    },
    corporate_onboarding_data: null,
    residential_address: null,
    corporate_entities: null,
    date_of_incorporation: null,
    country_of_incorporation: null,
    sc_company_type: null,
    sc_investor_category: "RETAIL",
    is_sophisticated_investor: false,
    phone_number: null,
    name: "Alice Test",
    address: null,
  } as any;
}

function completenessFor(documentType: string, identityNumber: string | null) {
  return buildInvestorProfileCompleteness({
    organizationType: "PERSONAL",
    personal: {
      name: "Alice Test",
      identityPrefix: personalInvestorIdentityFormatKind(documentType),
      identityNumber,
      dateOfBirth: "1990-01-01",
      gender: "MALE",
      state: "Johor",
      postalCode: "80000",
      nationality: "Malaysia",
      scInvestorCategory: "RETAIL",
      isSophisticatedInvestor: false,
    },
  });
}

describe("Personal Investor identityNumber admin save by document_type", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvestorUpdate.mockResolvedValue({});
  });

  it("Driving License invalid stored value → completeness incomplete", () => {
    expect(
      completenessFor("DRIVER_LICENSE", invalid).missing.some((m) => m.field === "identityNumber")
    ).toBe(true);
  });

  it("Admin tries to save invalid Driving License → rejected", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalInvestor({ documentType: "DRIVER_LICENSE", documentNumber: invalid })
    );

    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "org-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { identityNumber: invalid },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("Admin saves valid 12-digit Driving License → accepted", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalInvestor({ documentType: "DRIVER_LICENSE", documentNumber: invalid })
    );

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "org-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      patch: { identityNumber: valid12 },
    });

    expect(mockInvestorUpdate.mock.calls[0]?.[0]?.data?.document_number).toBe(valid12);
  });

  it("Passport remains unaffected", async () => {
    const passportValue = "AB-12 34";
    mockInvestorFindUnique.mockResolvedValue(
      personalInvestor({ documentType: "PASSPORT", documentNumber: passportValue })
    );

    expect(
      completenessFor("PASSPORT", passportValue).missing.some((m) => m.field === "identityNumber")
    ).toBe(false);

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: "org-1",
      actorUserId: "admin-1",
      source: "ADMIN",
      patch: { identityNumber: passportValue },
    });

    expect(mockInvestorUpdate.mock.calls[0]?.[0]?.data?.document_number).toBe(passportValue);
  });

  it("NRIC behavior remains unchanged", async () => {
    mockInvestorFindUnique.mockResolvedValue(
      personalInvestor({ documentType: "NATIONAL_ID", documentNumber: invalid })
    );

    expect(
      completenessFor("NATIONAL_ID", invalid).missing.some((m) => m.field === "identityNumber")
    ).toBe(true);

    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: "org-1",
        actorUserId: "admin-1",
        source: "ADMIN",
        patch: { identityNumber: invalid },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });
});
