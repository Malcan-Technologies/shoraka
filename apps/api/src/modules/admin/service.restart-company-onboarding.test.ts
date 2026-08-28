import { OrganizationType } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

const mockAdminCreateOnboardingLog = jest.fn();
const mockRegTankFindById = jest.fn();
const mockRegTankCancelOnboarding = jest.fn();
const mockRegTankCreateOnboarding = jest.fn();
const mockRegTankRestartOnboarding = jest.fn();
const mockInvestorOrgUpdate = jest.fn();
const mockIssuerOrgUpdate = jest.fn();

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({
    createOnboardingLog: (...args: unknown[]) => mockAdminCreateOnboardingLog(...args),
  })),
}));

jest.mock("../regtank/repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockRegTankFindById(...args),
    cancelOnboarding: (...args: unknown[]) => mockRegTankCancelOnboarding(...args),
    createOnboarding: (...args: unknown[]) => mockRegTankCreateOnboarding(...args),
  })),
}));

jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({
    restartOnboarding: (...args: unknown[]) => mockRegTankRestartOnboarding(...args),
  })),
}));

jest.mock("../regtank/service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../lib/http/request-utils", () => ({
  extractRequestMetadata: () => ({
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    deviceInfo: "test",
    deviceType: "desktop",
  }),
  getClientIp: () => "127.0.0.1",
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: {
      update: (...args: unknown[]) => mockInvestorOrgUpdate(...args),
    },
    issuerOrganization: {
      update: (...args: unknown[]) => mockIssuerOrgUpdate(...args),
    },
  },
}));

import { AdminService } from "./service";

const makeReq = () =>
  ({
    headers: {},
    ip: "127.0.0.1",
  }) as never;

describe("AdminService.restartOnboarding company persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegTankCancelOnboarding.mockResolvedValue({});
    mockRegTankCreateOnboarding.mockResolvedValue({});
    mockInvestorOrgUpdate.mockResolvedValue({});
    mockIssuerOrgUpdate.mockResolvedValue({});
    mockAdminCreateOnboardingLog.mockResolvedValue({});
  });

  it("investor company restart cancels old COD row and creates a new COD row", async () => {
    mockRegTankFindById.mockResolvedValue({
      id: "row-cod-old",
      request_id: "COD0001",
      status: "EXPIRED",
      user_id: "USR01",
      portal_type: "investor",
      organization_type: OrganizationType.COMPANY,
      onboarding_type: "CORPORATE",
      investor_organization_id: "org-investor-company",
      issuer_organization_id: null,
      investor_organization: { name: "Investor Company" },
      issuer_organization: null,
    });
    mockRegTankRestartOnboarding.mockResolvedValue({
      requestId: "COD0002",
      verifyLink: "https://masked.cod.link?requestId=COD0002",
      expiredIn: 86400,
    });

    const service = new AdminService();
    const result = await service.restartOnboarding(makeReq(), "row-cod-old", "admin-1");

    expect(mockRegTankCancelOnboarding).toHaveBeenCalledWith(
      "row-cod-old",
      expect.stringContaining("New requestId: COD0002")
    );
    expect(mockRegTankCreateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-investor-company",
        portalType: "investor",
        organizationType: OrganizationType.COMPANY,
        onboardingType: "CORPORATE",
        requestId: "COD0002",
        verifyLink: "https://masked.cod.link?requestId=COD0002",
      })
    );
    expect(result.newRequestId).toBe("COD0002");
    expect(mockAdminCreateOnboardingLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ONBOARDING_CANCELLED",
        portal: "admin",
        actorUserId: "admin-1",
        userId: "USR01",
        context: expect.objectContaining({
          portal: "ADMIN",
          source: "API",
          actorType: "ADMIN",
          actorUserId: "admin-1",
        }),
      })
    );
  });

  it("issuer company restart cancels old COD row and creates a new COD row", async () => {
    mockRegTankFindById.mockResolvedValue({
      id: "row-cod-old-issuer",
      request_id: "COD1001",
      status: "EXPIRED",
      user_id: "USR01",
      portal_type: "issuer",
      organization_type: OrganizationType.COMPANY,
      onboarding_type: "CORPORATE",
      investor_organization_id: null,
      issuer_organization_id: "org-issuer-company",
      investor_organization: null,
      issuer_organization: { name: "Issuer Company" },
    });
    mockRegTankRestartOnboarding.mockResolvedValue({
      requestId: "COD1002",
      verifyLink: "https://masked.cod.link?requestId=COD1002",
      expiredIn: 86400,
    });

    const service = new AdminService();
    const result = await service.restartOnboarding(makeReq(), "row-cod-old-issuer", "admin-1");

    expect(mockRegTankCancelOnboarding).toHaveBeenCalledWith(
      "row-cod-old-issuer",
      expect.stringContaining("New requestId: COD1002")
    );
    expect(mockRegTankCreateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-issuer-company",
        portalType: "issuer",
        organizationType: OrganizationType.COMPANY,
        onboardingType: "CORPORATE",
        requestId: "COD1002",
        verifyLink: "https://masked.cod.link?requestId=COD1002",
      })
    );
    expect(result.newRequestId).toBe("COD1002");
  });

  it("company restart requestId/link mismatch fails safely without cancel/create", async () => {
    mockRegTankFindById.mockResolvedValue({
      id: "row-cod-old",
      request_id: "COD0001",
      status: "EXPIRED",
      user_id: "USR01",
      portal_type: "investor",
      organization_type: OrganizationType.COMPANY,
      onboarding_type: "CORPORATE",
      investor_organization_id: "org-investor-company",
      issuer_organization_id: null,
      investor_organization: { name: "Investor Company" },
      issuer_organization: null,
    });
    mockRegTankRestartOnboarding.mockResolvedValue({
      requestId: "COD0002",
      verifyLink: "https://masked.cod.link?requestId=COD0999",
      expiredIn: 86400,
    });

    const service = new AdminService();
    await expect(service.restartOnboarding(makeReq(), "row-cod-old", "admin-1")).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: "REGTANK_CORPORATE_RESPONSE_MISMATCH",
    });
    expect(mockRegTankCancelOnboarding).not.toHaveBeenCalled();
    expect(mockRegTankCreateOnboarding).not.toHaveBeenCalled();
  });
});

