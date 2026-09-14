const mockRepository = {
  hasPersonalInvestorOrganization: jest.fn(),
  hasPersonalIssuerOrganization: jest.fn(),
  investorOrganizationNameExists: jest.fn(),
  issuerOrganizationNameExists: jest.fn(),
  findOwnedResumableCompanyByName: jest.fn(),
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

function createdInvestorOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_org_1",
    created_at: new Date("2026-08-10T01:00:00.000Z"),
    owner_user_id: "user_1",
    type: OrganizationType.COMPANY,
    name: "ABC Sdn Bhd",
    registration_number: null,
    onboarding_status: OnboardingStatus.PENDING,
    tnc_accepted: false,
    display_reference: "IVT-202608-D7F",
    ...overrides,
  };
}

function createdIssuerOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: "iss_org_1",
    created_at: new Date("2026-08-10T01:00:00.000Z"),
    owner_user_id: "user_1",
    type: OrganizationType.COMPANY,
    name: "ABC Sdn Bhd",
    registration_number: null,
    onboarding_status: OnboardingStatus.PENDING,
    tnc_accepted: false,
    onboarding_fee_paid_at: null,
    display_reference: "ISS-202608-DK3",
    ...overrides,
  };
}

describe("OrganizationService createOrganization incomplete company match", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.hasPersonalInvestorOrganization.mockResolvedValue(false);
    mockRepository.hasPersonalIssuerOrganization.mockResolvedValue(false);
    mockRepository.investorOrganizationNameExists.mockResolvedValue(false);
    mockRepository.issuerOrganizationNameExists.mockResolvedValue(false);
    mockRepository.findOwnedResumableCompanyByName.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      user_id: "user_1",
      roles: [UserRole.INVESTOR, UserRole.ISSUER],
      investor_account: [],
      issuer_account: [],
      cognito_sub: null,
    });
    mockPrisma.user.update.mockResolvedValue({});
  });

  it("creates a new investor company when there is no matching incomplete org", async () => {
    const created = createdInvestorOrg();
    mockRepository.createInvestorOrganization.mockResolvedValue(created);
    mockTx.investorOrganization.findUniqueOrThrow.mockResolvedValue(created);

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "investor", {
      type: "COMPANY",
      name: "ABC Sdn Bhd",
    });

    expect(result.outcome).toBe("CREATED");
    expect(result.organization.id).toBe("inv_org_1");
    expect(mockRepository.createInvestorOrganization).toHaveBeenCalledTimes(1);
    expect(mockRepository.addOrganizationMember).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          investor_account: { set: ["temp"] },
        }),
      })
    );
  });

  it("creates a new issuer company when there is no matching incomplete org", async () => {
    const created = createdIssuerOrg();
    mockRepository.createIssuerOrganization.mockResolvedValue(created);
    mockTx.issuerOrganization.findUniqueOrThrow.mockResolvedValue(created);

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "issuer", {
      type: "COMPANY",
      name: "ABC Sdn Bhd",
    });

    expect(result.outcome).toBe("CREATED");
    expect(result.organization.id).toBe("iss_org_1");
    expect(mockRepository.createIssuerOrganization).toHaveBeenCalledTimes(1);
    expect(mockRepository.addOrganizationMember).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issuer_account: { set: ["temp"] },
        }),
      })
    );
  });

  it("returns the existing investor org instead of creating when an owned incomplete name matches", async () => {
    const existing = createdInvestorOrg({
      id: "inv_existing",
      tnc_accepted: true,
      display_reference: "IVT-202608-AAA",
    });
    mockRepository.findOwnedResumableCompanyByName.mockResolvedValue(existing);

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "investor", {
      type: "COMPANY",
      name: "ABC Sdn Bhd",
    });

    expect(result.outcome).toBe("EXISTING_INCOMPLETE_MATCH");
    expect(result.organization.id).toBe("inv_existing");
    expect(mockRepository.findOwnedResumableCompanyByName).toHaveBeenCalledWith(
      "user_1",
      "investor",
      "ABC Sdn Bhd"
    );
    expect(mockRepository.createInvestorOrganization).not.toHaveBeenCalled();
    expect(mockRepository.addOrganizationMember).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns the existing issuer org instead of creating when an owned incomplete name matches", async () => {
    const existing = createdIssuerOrg({
      id: "iss_existing",
      tnc_accepted: true,
      onboarding_fee_paid_at: new Date("2026-08-11T00:00:00.000Z"),
    });
    mockRepository.findOwnedResumableCompanyByName.mockResolvedValue(existing);

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "issuer", {
      type: "COMPANY",
      name: "  abc sdn bhd  ",
    });

    expect(result.outcome).toBe("EXISTING_INCOMPLETE_MATCH");
    expect(result.organization.id).toBe("iss_existing");
    expect(mockRepository.findOwnedResumableCompanyByName).toHaveBeenCalledWith(
      "user_1",
      "issuer",
      "  abc sdn bhd  "
    );
    expect(mockRepository.createIssuerOrganization).not.toHaveBeenCalled();
    expect(mockRepository.addOrganizationMember).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("creates a separate investor company when allowDuplicateIncomplete is true", async () => {
    const existing = createdInvestorOrg({ id: "inv_existing" });
    mockRepository.findOwnedResumableCompanyByName.mockResolvedValue(existing);
    const created = createdInvestorOrg({
      id: "inv_org_2",
      display_reference: "IVT-202608-BBB",
    });
    mockRepository.createInvestorOrganization.mockResolvedValue(created);
    mockTx.investorOrganization.findUniqueOrThrow.mockResolvedValue(created);

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "investor", {
      type: "COMPANY",
      name: "ABC Sdn Bhd",
      allowDuplicateIncomplete: true,
    });

    expect(result.outcome).toBe("CREATED");
    expect(result.organization.id).toBe("inv_org_2");
    expect(result.organization.id).not.toBe("inv_existing");
    expect(mockRepository.findOwnedResumableCompanyByName).not.toHaveBeenCalled();
    expect(mockRepository.createInvestorOrganization).toHaveBeenCalledTimes(1);
    expect(mockRepository.addOrganizationMember).toHaveBeenCalledTimes(1);
  });

  it("creates a separate issuer company when allowDuplicateIncomplete is true", async () => {
    mockRepository.findOwnedResumableCompanyByName.mockResolvedValue(createdIssuerOrg({ id: "iss_existing" }));
    const created = createdIssuerOrg({
      id: "iss_org_2",
      display_reference: "ISS-202608-BBB",
    });
    mockRepository.createIssuerOrganization.mockResolvedValue(created);
    mockTx.issuerOrganization.findUniqueOrThrow.mockResolvedValue(created);

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "issuer", {
      type: "COMPANY",
      name: "ABC Sdn Bhd",
      allowDuplicateIncomplete: true,
    });

    expect(result.outcome).toBe("CREATED");
    expect(result.organization.id).toBe("iss_org_2");
    expect(mockRepository.findOwnedResumableCompanyByName).not.toHaveBeenCalled();
    expect(mockRepository.createIssuerOrganization).toHaveBeenCalledTimes(1);
  });

  it("does not match against another user's org because lookup is owner-scoped", async () => {
    mockRepository.findOwnedResumableCompanyByName.mockResolvedValue(null);
    const created = createdInvestorOrg();
    mockRepository.createInvestorOrganization.mockResolvedValue(created);
    mockTx.investorOrganization.findUniqueOrThrow.mockResolvedValue(created);

    const service = new OrganizationService();
    await service.createOrganization({} as any, "user_1", "investor", {
      type: "COMPANY",
      name: "ABC Sdn Bhd",
    });

    expect(mockRepository.findOwnedResumableCompanyByName).toHaveBeenCalledWith(
      "user_1",
      "investor",
      "ABC Sdn Bhd"
    );
    expect(mockRepository.createInvestorOrganization).toHaveBeenCalledTimes(1);
  });

  it("skips incomplete-name matching for PERSONAL investor creation", async () => {
    mockRepository.hasPersonalInvestorOrganization.mockResolvedValue(false);
    const created = createdInvestorOrg({
      id: "personal_1",
      type: OrganizationType.PERSONAL,
      name: null,
      onboarding_status: OnboardingStatus.IN_PROGRESS,
    });
    mockRepository.createInvestorOrganization.mockResolvedValue(created);
    mockTx.investorOrganization.findUniqueOrThrow.mockResolvedValue(created);

    const service = new OrganizationService();
    const result = await service.createOrganization({} as any, "user_1", "investor", {
      type: "PERSONAL",
    });

    expect(result.outcome).toBe("CREATED");
    expect(mockRepository.findOwnedResumableCompanyByName).not.toHaveBeenCalled();
    expect(mockRepository.hasPersonalInvestorOrganization).toHaveBeenCalledWith("user_1");
  });

  it("still blocks a second PERSONAL investor organization", async () => {
    mockRepository.hasPersonalInvestorOrganization.mockResolvedValue(true);
    const service = new OrganizationService();

    await expect(
      service.createOrganization({} as any, "user_1", "investor", { type: "PERSONAL" })
    ).rejects.toMatchObject({ code: "PERSONAL_ORG_EXISTS" });

    expect(mockRepository.createInvestorOrganization).not.toHaveBeenCalled();
    expect(mockRepository.findOwnedResumableCompanyByName).not.toHaveBeenCalled();
  });
});
