import { OnboardingStatus, OrganizationType } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

const mockFindByOrganizationId = jest.fn();
const mockCreateOnboarding = jest.fn();
const mockCancelOnboarding = jest.fn();
const mockUpdateStatus = jest.fn();

const mockSetOnboardingSettings = jest.fn().mockResolvedValue(undefined);
const mockRestartOnboarding = jest.fn();

const mockFindInvestorOrganizationById = jest.fn();
const mockFindIssuerOrganizationById = jest.fn();

const mockUserFindUnique = jest.fn();

jest.mock("./repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findByOrganizationId: (...args: unknown[]) => mockFindByOrganizationId(...args),
    createOnboarding: (...args: unknown[]) => mockCreateOnboarding(...args),
    cancelOnboarding: (...args: unknown[]) => mockCancelOnboarding(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  })),
}));

jest.mock("./api-client", () => ({
  getRegTankAPIClient: () => ({
    setOnboardingSettings: (...args: unknown[]) => mockSetOnboardingSettings(...args),
    restartOnboarding: (...args: unknown[]) => mockRestartOnboarding(...args),
  }),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: (...args: unknown[]) => mockFindIssuerOrganizationById(...args),
  })),
}));

jest.mock("../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    createOnboardingLog: jest.fn(),
  })),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    issuerOrganization: {
      findUnique: jest.fn().mockResolvedValue({
        id: "org-company-iss",
        onboarding_fee_paid_at: new Date("2026-01-01T00:00:00.000Z"),
      }),
    },
    gatewayPayment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    onboardingLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../../config/regtank", () => ({
  getRegTankConfig: () => ({
    redirectUrlInvestor: "https://investor.example.com",
    redirectUrlIssuer: "https://issuer.example.com",
  }),
}));

import { RegTankService } from "./service";

const makeReq = () =>
  ({
    headers: {},
    ip: "127.0.0.1",
  }) as never;

describe("RegTankService.retryOnboarding personal restart persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({
      user_id: "USR01",
      email: "test@example.com",
    });
    mockFindIssuerOrganizationById.mockResolvedValue(null);
  });

  it("restart R03 -> R04 creates separate R04 row and cancels R03", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org1",
      owner_user_id: "USR01",
      type: OrganizationType.PERSONAL,
      onboarding_status: OnboardingStatus.IN_PROGRESS,
    });
    mockFindByOrganizationId.mockResolvedValue({
      id: "row-r03",
      request_id: "LD83612-R03",
      status: "EXPIRED",
      portal_type: "investor",
    });
    mockRestartOnboarding.mockResolvedValue({
      requestId: "LD83612-R04",
      verifyLink: "https://masked.link?requestId=LD83612-R04",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    const result = await service.retryOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(mockCancelOnboarding).toHaveBeenCalledWith(
      "row-r03",
      expect.stringContaining("New requestId: LD83612-R04")
    );
    expect(mockCreateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org1",
        requestId: "LD83612-R04",
        verifyLink: "https://masked.link?requestId=LD83612-R04",
        onboardingType: "INDIVIDUAL",
        status: "IN_PROGRESS",
      })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(result.requestId).toBe("LD83612-R04");
  });

  it("response requestId/link mismatch is handled safely", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org1",
      owner_user_id: "USR01",
      type: OrganizationType.PERSONAL,
      onboarding_status: OnboardingStatus.IN_PROGRESS,
    });
    mockFindByOrganizationId.mockResolvedValue({
      id: "row-r03",
      request_id: "LD83612-R03",
      status: "EXPIRED",
      portal_type: "investor",
    });
    mockRestartOnboarding.mockResolvedValue({
      requestId: "LD83612-R03",
      verifyLink: "https://masked.link?requestId=LD83612-R04",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    await expect(
      service.retryOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: "REGTANK_RESTART_RESPONSE_MISMATCH",
    });
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it("later personal retry does not overwrite EXPIRED R03 back to IN_PROGRESS", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org1",
      owner_user_id: "USR01",
      type: OrganizationType.PERSONAL,
      onboarding_status: OnboardingStatus.IN_PROGRESS,
    });
    mockFindByOrganizationId.mockResolvedValue({
      id: "row-r03",
      request_id: "LD83612-R03",
      status: "EXPIRED",
      portal_type: "investor",
    });
    mockRestartOnboarding.mockResolvedValue({
      requestId: "LD83612-R04",
      verifyLink: "https://masked.link?requestId=LD83612-R04",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    await service.retryOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "LD83612-R03",
      expect.objectContaining({ status: "IN_PROGRESS" })
    );
    expect(mockCancelOnboarding).toHaveBeenCalledTimes(1);
    expect(mockCreateOnboarding).toHaveBeenCalledTimes(1);
  });

  it("investor company retry COD-A -> COD-B cancels old row and creates new row", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-company",
      owner_user_id: "USR01",
      type: OrganizationType.COMPANY,
      onboarding_status: OnboardingStatus.PENDING,
    });
    mockFindByOrganizationId.mockResolvedValue({
      id: "row-cod",
      request_id: "COD0001",
      status: "EXPIRED",
      portal_type: "investor",
    });
    mockRestartOnboarding.mockResolvedValue({
      requestId: "COD0002",
      verifyLink: "https://masked.cod.link?requestId=COD0002",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    const result = await service.retryOnboarding(makeReq(), "USR01", "org-company", "investor");

    expect(mockCancelOnboarding).toHaveBeenCalledWith(
      "row-cod",
      expect.stringContaining("New requestId: COD0002")
    );
    expect(mockCreateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-company",
        portalType: "investor",
        requestId: "COD0002",
        onboardingType: "CORPORATE",
        status: "PENDING",
      })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(result.requestId).toBe("COD0002");
  });

  it("issuer company retry COD-A -> COD-B cancels old row and creates new row", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue(null);
    mockFindIssuerOrganizationById.mockResolvedValue({
      id: "org-company-iss",
      owner_user_id: "USR01",
      type: OrganizationType.COMPANY,
      onboarding_status: OnboardingStatus.PENDING,
      onboarding_fee_paid_at: new Date(),
    });
    mockFindByOrganizationId.mockResolvedValue({
      id: "row-cod-issuer",
      request_id: "COD1001",
      status: "EXPIRED",
      portal_type: "issuer",
    });
    mockRestartOnboarding.mockResolvedValue({
      requestId: "COD1002",
      verifyLink: "https://masked.cod.link?requestId=COD1002",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    const result = await service.retryOnboarding(makeReq(), "USR01", "org-company-iss", "issuer");

    expect(mockCancelOnboarding).toHaveBeenCalledWith(
      "row-cod-issuer",
      expect.stringContaining("New requestId: COD1002")
    );
    expect(mockCreateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-company-iss",
        portalType: "issuer",
        requestId: "COD1002",
        onboardingType: "CORPORATE",
        status: "PENDING",
      })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(result.requestId).toBe("COD1002");
  });

  it("company retry response requestId/link mismatch is handled safely", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-company",
      owner_user_id: "USR01",
      type: OrganizationType.COMPANY,
      onboarding_status: OnboardingStatus.PENDING,
    });
    mockFindByOrganizationId.mockResolvedValue({
      id: "row-cod",
      request_id: "COD0001",
      status: "EXPIRED",
      portal_type: "investor",
    });
    mockRestartOnboarding.mockResolvedValue({
      requestId: "COD0002",
      verifyLink: "https://masked.cod.link?requestId=COD0009",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    await expect(
      service.retryOnboarding(makeReq(), "USR01", "org-company", "investor")
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: "REGTANK_CORPORATE_RESPONSE_MISMATCH",
    });
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it("company retry with same COD request ID updates existing row only", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-company",
      owner_user_id: "USR01",
      type: OrganizationType.COMPANY,
      onboarding_status: OnboardingStatus.PENDING,
    });
    mockFindByOrganizationId.mockResolvedValue({
      id: "row-cod",
      request_id: "COD0001",
      status: "EXPIRED",
      portal_type: "investor",
    });
    mockRestartOnboarding.mockResolvedValue({
      requestId: "COD0001",
      verifyLink: "https://masked.cod.link?requestId=COD0001",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    const result = await service.retryOnboarding(makeReq(), "USR01", "org-company", "investor");

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD0001",
      expect.objectContaining({ status: "PENDING" })
    );
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
    expect(result.requestId).toBe("COD0001");
  });
});

