import { OrganizationType } from "@prisma/client";
import { RegTankService } from "./service";

const mockPersistOrganizationUpdateAndOnboardingLogs = jest.fn();
const mockInvestorFindUnique = jest.fn();
const mockIssuerFindUnique = jest.fn();
const mockIssuerUpdate = jest.fn();

jest.mock("./repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("./api-client", () => ({
  getRegTankAPIClient: () => ({}),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../lib/audit", () => ({
  persistOrganizationUpdateAndOnboardingLogs: (...args: unknown[]) =>
    mockPersistOrganizationUpdateAndOnboardingLogs(...args),
  webhookAuditContext: () => ({}),
  auditContextFromRequest: () => ({}),
  createOnboardingLogRow: jest.fn(),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
    },
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
      update: (...args: unknown[]) => mockIssuerUpdate(...args),
    },
  },
}));

function makeRegTankDetails(overrides: Record<string, unknown> = {}) {
  return {
    userProfile: {
      firstName: "Alice",
      lastName: "Tan",
      middleName: "K",
      nationality: "MALAYSIA",
      country: "MY",
      idIssuingCountry: "MY",
      gender: "MALE",
      address: "Block 1, Some Street",
      dateOfBirth: "1992-01-01",
      documentType: "NRIC",
      documentNum: "900101011234",
      phoneNumber: "+60123456789",
      formContent: {
        displayAreas: [],
      },
      ...((overrides.userProfile as Record<string, unknown> | undefined) ?? {}),
    },
    kycId: "kyc-1",
    ...overrides,
  };
}

describe("RegTank master identity persistence stamps profile_field_sources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stamps RegTank DOB source when DOB was missing (investor)", async () => {
    mockInvestorFindUnique.mockResolvedValue({
      id: "org-1",
      type: OrganizationType.PERSONAL,
      name: "Personal Org",
      owner_user_id: "user-1",
      is_sophisticated_investor: false,
      sophisticated_investor_reason: null,
      first_name: null,
      last_name: null,
      middle_name: null,
      nationality: null,
      country: null,
      id_issuing_country: null,
      gender: null,
      address: null,
      date_of_birth: null,
      document_type: null,
      document_number: null,
      phone_number: null,
      legal_name_on_id: null,
      profile_field_sources: {},
    });

    mockPersistOrganizationUpdateAndOnboardingLogs.mockResolvedValue(undefined);

    const service = new RegTankService();
    await (service as any).extractAndUpdateOrganizationData("org-1", "investor", makeRegTankDetails(), undefined);

    const updateData = mockPersistOrganizationUpdateAndOnboardingLogs.mock.calls[0]?.[0]?.data;
    expect((updateData.profile_field_sources as any)?.dateOfBirth?.source).toBe("REGTANK");
  });

  it("does not overwrite user DOB value nor provenance when already filled (investor)", async () => {
    mockInvestorFindUnique.mockResolvedValue({
      id: "org-1",
      type: OrganizationType.PERSONAL,
      name: "Personal Org",
      owner_user_id: "user-1",
      is_sophisticated_investor: false,
      sophisticated_investor_reason: null,
      first_name: null,
      last_name: null,
      middle_name: null,
      nationality: null,
      country: null,
      id_issuing_country: null,
      gender: null,
      address: null,
      date_of_birth: new Date("1990-01-01T00:00:00.000Z"),
      document_type: null,
      document_number: null,
      phone_number: null,
      legal_name_on_id: null,
      profile_field_sources: {
        dateOfBirth: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });

    mockPersistOrganizationUpdateAndOnboardingLogs.mockResolvedValue(undefined);

    const service = new RegTankService();
    await (service as any).extractAndUpdateOrganizationData("org-1", "investor", makeRegTankDetails({ userProfile: { dateOfBirth: "1999-01-01" } }), undefined);

    const updateData = mockPersistOrganizationUpdateAndOnboardingLogs.mock.calls[0]?.[0]?.data;
    expect(updateData.date_of_birth).toEqual(new Date("1990-01-01T00:00:00.000Z"));
    expect((updateData.profile_field_sources as any)?.dateOfBirth?.source).toBe("USER");
  });

  it("stamps RegTank DOB source when DOB was missing (issuer)", async () => {
    mockIssuerFindUnique.mockResolvedValue({
      id: "org-1",
      first_name: null,
      last_name: null,
      middle_name: null,
      nationality: null,
      country: null,
      id_issuing_country: null,
      gender: null,
      address: null,
      date_of_birth: null,
      document_type: null,
      document_number: null,
      phone_number: null,
      profile_field_sources: {},
    });
    mockIssuerUpdate.mockResolvedValue({});
    const service = new RegTankService();
    await (service as any).extractAndUpdateOrganizationData("org-1", "issuer", makeRegTankDetails(), undefined);

    const updateArg = mockIssuerUpdate.mock.calls[0]?.[0]?.data;
    expect((updateArg.profile_field_sources as any)?.dateOfBirth?.source).toBe("REGTANK");
  });

  it("does not overwrite user DOB value nor provenance when already filled (issuer)", async () => {
    mockIssuerFindUnique.mockResolvedValue({
      id: "org-1",
      first_name: null,
      last_name: null,
      middle_name: null,
      nationality: null,
      country: null,
      id_issuing_country: null,
      gender: null,
      address: null,
      date_of_birth: new Date("1990-01-01T00:00:00.000Z"),
      document_type: null,
      document_number: null,
      phone_number: null,
      profile_field_sources: {
        dateOfBirth: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    });
    mockIssuerUpdate.mockResolvedValue({});

    const service = new RegTankService();
    await (service as any).extractAndUpdateOrganizationData(
      "org-1",
      "issuer",
      makeRegTankDetails({ userProfile: { dateOfBirth: "1999-01-01" } }),
      undefined
    );

    const updateArg = mockIssuerUpdate.mock.calls[0]?.[0]?.data;
    expect(updateArg.date_of_birth).toEqual(new Date("1990-01-01T00:00:00.000Z"));
    expect((updateArg.profile_field_sources as any)?.dateOfBirth?.source).toBe("USER");
  });
});

