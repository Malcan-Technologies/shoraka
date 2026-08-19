const mockFindIssuerOrganizationById = jest.fn();
const mockFindInvestorOrganizationById = jest.fn();
const mockHasCompletedRequiredAcceptances = jest.fn();

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: { update: jest.fn() },
    issuerOrganization: { update: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock("../onboarding/utils/advance-onboarding-status", () => ({
  advanceOnboardingStatusFromFlags: jest.fn(async () => ({ changed: false })),
}));

jest.mock("../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    createOnboardingLog: jest.fn(),
  })),
}));

jest.mock("../legal-documents/acceptance-service", () => ({
  legalDocumentAcceptanceService: {
    hasCompletedRequiredAcceptances: (...args: unknown[]) =>
      mockHasCompletedRequiredAcceptances(...args),
  },
}));

jest.mock("../payment/onboarding-fee-service", () => ({
  assertIssuerOnboardingFeePaid: jest.fn(),
}));

jest.mock("./repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) =>
      mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: (...args: unknown[]) =>
      mockFindIssuerOrganizationById(...args),
  })),
}));

import { prisma } from "../../lib/prisma";
import { OrganizationService } from "./service";
import { advanceOnboardingStatusFromFlags } from "../onboarding/utils/advance-onboarding-status";

const mockReq = {
  headers: { "user-agent": "JestAgent/1.0" },
  socket: { remoteAddress: "127.0.0.1" },
} as never;

function ownerOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: "org1",
    owner_user_id: "owner1",
    type: "COMPANY",
    name: "Test Co",
    tnc_accepted: false,
    members: [],
    ...overrides,
  };
}

describe("acceptTnc legal document gate", () => {
  let service: OrganizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationService();

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      user_id: "owner1",
      email: "owner@example.com",
    });
    (prisma.issuerOrganization.update as jest.Mock).mockResolvedValue({});
    (prisma.investorOrganization.update as jest.Mock).mockResolvedValue({});
    mockFindIssuerOrganizationById.mockResolvedValue(ownerOrg());
    mockFindInvestorOrganizationById.mockResolvedValue(ownerOrg());
  });

  it.each([
    ["issuer", "issuer" as const, prisma.issuerOrganization.update],
    ["investor", "investor" as const, prisma.investorOrganization.update],
  ])(
    "blocks %s accept-tnc when zero required published documents exist",
    async (_label, portalType, updateMock) => {
      mockHasCompletedRequiredAcceptances.mockResolvedValue({
        hasRequiredDocuments: false,
        allAccepted: true,
      });

      await expect(
        service.acceptTnc(mockReq, "owner1", "org1", portalType)
      ).rejects.toMatchObject({
        code: "LEGAL_DOCUMENTS_UNAVAILABLE",
      });

      expect(updateMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["issuer", "issuer" as const, prisma.issuerOrganization.update],
    ["investor", "investor" as const, prisma.investorOrganization.update],
  ])(
    "blocks %s accept-tnc when required published documents are not all accepted",
    async (_label, portalType, updateMock) => {
      mockHasCompletedRequiredAcceptances.mockResolvedValue({
        hasRequiredDocuments: true,
        allAccepted: false,
      });

      await expect(
        service.acceptTnc(mockReq, "owner1", "org1", portalType)
      ).rejects.toMatchObject({
        code: "LEGAL_DOCUMENTS_REQUIRED",
      });

      expect(updateMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["issuer", "issuer" as const, prisma.issuerOrganization.update],
    ["investor", "investor" as const, prisma.investorOrganization.update],
  ])(
    "allows %s accept-tnc when all currently required published documents are accepted",
    async (_label, portalType, updateMock) => {
      mockHasCompletedRequiredAcceptances.mockResolvedValue({
        hasRequiredDocuments: true,
        allAccepted: true,
      });

      const result = await service.acceptTnc(mockReq, "owner1", "org1", portalType);

      expect(result).toEqual({ success: true, tncAccepted: true });
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: "org1" },
        data: { tnc_accepted: true },
      });
      expect(advanceOnboardingStatusFromFlags).toHaveBeenCalled();
    }
  );

  it("allows an organization member to accept tnc", async () => {
    mockFindIssuerOrganizationById.mockResolvedValue(
      ownerOrg({
        members: [{ user_id: "member1" }],
      })
    );
    mockHasCompletedRequiredAcceptances.mockResolvedValue({
      hasRequiredDocuments: true,
      allAccepted: true,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      user_id: "member1",
      email: "member@example.com",
    });

    const result = await service.acceptTnc(mockReq, "member1", "org1", "issuer");

    expect(result).toEqual({ success: true, tncAccepted: true });
    expect(prisma.issuerOrganization.update).toHaveBeenCalledWith({
      where: { id: "org1" },
      data: { tnc_accepted: true },
    });
  });
});
