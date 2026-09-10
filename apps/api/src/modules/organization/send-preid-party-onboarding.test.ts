import { OnboardingStatus, OrganizationMemberRole, OrganizationType } from "@prisma/client";
import type { ApplicationPersonRow } from "@cashsouk/types";
import type { RegTankIndividualOnboardingRequest } from "../regtank/types";

const mockCreateIndividualOnboarding = jest.fn();
const mockSendOnboardingEmail = jest.fn();
const mockPartyFindFirst = jest.fn();
const mockSupplementFindFirst = jest.fn();
const mockSupplementCreate = jest.fn();
const mockSupplementUpdate = jest.fn();
const mockIssuerFindUnique = jest.fn();

const mockLockParty = jest.fn().mockResolvedValue(undefined);
const mockLockSupplement = jest.fn().mockResolvedValue(undefined);

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        organizationPartyProfile: {
          findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
        },
        ctosPartySupplement: {
          findFirst: (...args: unknown[]) => mockSupplementFindFirst(...args),
          create: (...args: unknown[]) => mockSupplementCreate(...args),
          update: (...args: unknown[]) => mockSupplementUpdate(...args),
        },
        issuerOrganization: {
          findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
        },
        investorOrganization: {
          findUnique: jest.fn(),
        },
      }),
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
    },
    ctosPartySupplement: {
      findFirst: (...args: unknown[]) => mockSupplementFindFirst(...args),
      create: (...args: unknown[]) => mockSupplementCreate(...args),
      update: (...args: unknown[]) => mockSupplementUpdate(...args),
    },
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
    },
    investorOrganization: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("./repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    lockOrganizationPartyProfileForUpdate: (...args: unknown[]) => mockLockParty(...args),
    lockCtosPartySupplementForUpdate: (...args: unknown[]) => mockLockSupplement(...args),
  })),
}));

jest.mock("../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  AdminUpdateUserAttributesCommand: jest.fn(),
}));

jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({
    createIndividualOnboarding: (...args: unknown[]) => mockCreateIndividualOnboarding(...args),
    renewIndividualOnboardingToken: jest.fn(),
  })),
}));

jest.mock("../../lib/email/ses", () => ({
  sendOnboardingEmail: (...args: unknown[]) => mockSendOnboardingEmail(...args),
}));

import { OrganizationService } from "./service";

const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";

function personRow(overrides: Partial<ApplicationPersonRow> = {}): ApplicationPersonRow {
  return {
    matchKey: generatedKey,
    name: "Ahmad",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR"],
    sharePercentage: null,
    status: "",
    action: null,
    screening: null,
    onboarding: { status: null, id: null },
    requestId: null,
    requestIdType: null,
    icFrontUrl: null,
    icBackUrl: null,
    email: "ahmad@example.com",
    ...overrides,
  };
}

function completedOrg() {
  return {
    id: "org-1",
    owner_user_id: "user-1",
    type: OrganizationType.COMPANY,
    onboarding_status: OnboardingStatus.COMPLETED,
    members: [{ user_id: "user-1", role: OrganizationMemberRole.ORGANIZATION_ADMIN }],
  };
}

describe("sendDirectorCtosPartyOnboarding pre-ID party_key", () => {
  let service: OrganizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationService();
    jest.spyOn(service, "getOrganization").mockResolvedValue(completedOrg() as never);
    mockCreateIndividualOnboarding.mockResolvedValue({
      requestId: "req-1",
      verifyLink: "https://verify.example/1",
    });
    mockSendOnboardingEmail.mockResolvedValue(undefined);
    mockSupplementFindFirst.mockResolvedValue(null);
    mockSupplementCreate.mockResolvedValue({ id: "sup-1" });
    mockIssuerFindUnique.mockResolvedValue({ director_kyc_status: null });
  });

  it("sends with exact user:{uuid} lookup, empty governmentIdNumber, and exact supplement key", async () => {
    jest.spyOn(service, "getCorporateEntities").mockResolvedValue({
      people: [personRow()],
      directorKycStatus: null,
      ctosPartySupplements: [],
      directors: [],
      shareholders: [],
      corporateShareholders: [],
    });
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: generatedKey,
      email: "ahmad@example.com",
      identity_number: null,
      name: "Ahmad",
    });

    const result = await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: generatedKey,
    });
    expect(result.requestId).toBe("req-1");
    expect(mockPartyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { issuer_organization_id: "org-1", party_key: generatedKey },
      })
    );
    const request = mockCreateIndividualOnboarding.mock.calls[0]?.[0] as RegTankIndividualOnboardingRequest;
    expect(request.governmentIdNumber).toBe("");
    expect(request.forename).toBe("Ahmad");
    expect(request.surname).toBe(".");
    expect(request.referenceId.includes(":")).toBe(false);
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ party_key: generatedKey }),
      })
    );
  });

  it("sends the existing government ID for a CTOS/NRIC Person", async () => {
    const nricKey = "900101101234";
    jest.spyOn(service, "getCorporateEntities").mockResolvedValue({
      people: [personRow({ matchKey: nricKey, name: "Sarah Tan", email: "sarah@example.com" })],
      directorKycStatus: null,
      ctosPartySupplements: [],
      directors: [],
      shareholders: [],
      corporateShareholders: [],
    });
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: nricKey,
      email: "sarah@example.com",
      identity_number: "900101-10-1234",
      name: "Sarah Tan",
    });

    await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: "900101-10-1234",
    });
    expect(mockPartyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { issuer_organization_id: "org-1", party_key: nricKey },
      })
    );
    const request = mockCreateIndividualOnboarding.mock.calls[0]?.[0] as RegTankIndividualOnboardingRequest;
    expect(request.governmentIdNumber).toBe(nricKey);
    expect(request.forename).toBe("Sarah");
    expect(request.surname).toBe("Tan");
  });

  it("rejects Send when the Person name is empty", async () => {
    jest.spyOn(service, "getCorporateEntities").mockResolvedValue({
      people: [personRow({ name: "" })],
      directorKycStatus: null,
      ctosPartySupplements: [],
      directors: [],
      shareholders: [],
      corporateShareholders: [],
    });
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: generatedKey,
      email: "ahmad@example.com",
      identity_number: null,
      name: "   ",
    });

    await expect(
      service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
        partyKey: generatedKey,
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
  });
});
