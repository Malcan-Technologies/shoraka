const mockRepository = {
  hasPersonalInvestorOrganization: jest.fn(),
  hasPersonalIssuerOrganization: jest.fn(),
  investorOrganizationNameExists: jest.fn(),
  issuerOrganizationNameExists: jest.fn(),
  createInvestorOrganization: jest.fn(),
  createIssuerOrganization: jest.fn(),
  addOrganizationMember: jest.fn(),
};

const mockTx: any = {
  investorOrganization: {
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  issuerOrganization: {
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
};

const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(async (cb: any) => cb(mockTx)),
};

const mockAllocateDisplayReference = jest.fn(async (input: any, persist: any) => {
  const ref = input.moduleCode === "IVT" ? "IVT-202608-D7F" : "ISS-202608-DK3";
  await persist(input.tx, ref);
  return ref;
});

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("./repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => mockRepository),
}));

jest.mock("../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../lib/display-reference", () => ({
  allocateDisplayReference: (...args: any[]) => mockAllocateDisplayReference(...args),
}));

jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  AdminUpdateUserAttributesCommand: jest.fn(),
}));

import { OrganizationType, OnboardingStatus, UserRole } from "@prisma/client";
import { OrganizationService } from "./service";

describe("OrganizationService createOrganization display reference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.hasPersonalInvestorOrganization.mockResolvedValue(false);
    mockRepository.hasPersonalIssuerOrganization.mockResolvedValue(false);
    mockRepository.investorOrganizationNameExists.mockResolvedValue(false);
    mockRepository.issuerOrganizationNameExists.mockResolvedValue(false);
    mockPrisma.user.findUnique.mockResolvedValue({
      user_id: "user_1",
      roles: [UserRole.INVESTOR, UserRole.ISSUER],
      investor_account: [],
      issuer_account: [],
      cognito_sub: null,
    });
    mockPrisma.user.update.mockResolvedValue({});
  });

  it("allocates IVT reference when creating investor organization", async () => {
    mockRepository.createInvestorOrganization.mockResolvedValue({
      id: "inv_org_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
      owner_user_id: "user_1",
      type: OrganizationType.COMPANY,
      name: "Investor Org",
      registration_number: "123",
      onboarding_status: OnboardingStatus.IN_PROGRESS,
    });
    mockTx.investorOrganization.findUniqueOrThrow.mockResolvedValue({
      id: "inv_org_1",
      display_reference: "IVT-202608-D7F",
    });

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "investor", {
      type: "COMPANY",
      name: "Investor Org",
      registrationNumber: "123",
    });

    expect(mockAllocateDisplayReference).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleCode: "IVT",
        entityType: "investor_organization",
        entityId: "inv_org_1",
      }),
      expect.any(Function)
    );
    expect(mockTx.investorOrganization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_org_1" },
        data: { display_reference: "IVT-202608-D7F" },
      })
    );
    expect((result as any).display_reference).toBe("IVT-202608-D7F");
  });

  it("allocates ISS reference when creating issuer organization", async () => {
    mockRepository.createIssuerOrganization.mockResolvedValue({
      id: "iss_org_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
      owner_user_id: "user_1",
      type: OrganizationType.COMPANY,
      name: "Issuer Org",
      registration_number: "999",
      onboarding_status: OnboardingStatus.IN_PROGRESS,
    });
    mockTx.issuerOrganization.findUniqueOrThrow.mockResolvedValue({
      id: "iss_org_1",
      display_reference: "ISS-202608-DK3",
    });

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "issuer", {
      type: "COMPANY",
      name: "Issuer Org",
      registrationNumber: "999",
    });

    expect(mockAllocateDisplayReference).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleCode: "ISS",
        entityType: "issuer_organization",
        entityId: "iss_org_1",
      }),
      expect.any(Function)
    );
    expect(mockTx.issuerOrganization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "iss_org_1" },
        data: { display_reference: "ISS-202608-DK3" },
      })
    );
    expect((result as any).display_reference).toBe("ISS-202608-DK3");
  });
});
