import { OnboardingStatus, OrganizationType } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

const mockFindByOrganizationId = jest.fn();
const mockCreateOnboarding = jest.fn();
const mockCancelOnboarding = jest.fn();

const mockSetOnboardingSettings = jest.fn().mockResolvedValue(undefined);
const mockSetWebhookPreferences = jest.fn().mockResolvedValue(undefined);
const mockCreateIndividualOnboarding = jest.fn();
const mockRestartOnboarding = jest.fn();
const mockCreateCorporateOnboarding = jest.fn();
const mockGetOnboardingDetails = jest.fn();

const mockFindInvestorOrganizationById = jest.fn();
const mockFindIssuerOrganizationById = jest.fn();
const mockUpdateInvestorOrganizationOnboarding = jest.fn().mockResolvedValue(undefined);

const mockCreateOnboardingLog = jest.fn().mockResolvedValue(undefined);

const mockUserFindUnique = jest.fn();
const mockOnboardingLogCreate = jest.fn().mockResolvedValue(undefined);

jest.mock("./repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findByOrganizationId: (...args: unknown[]) => mockFindByOrganizationId(...args),
    createOnboarding: (...args: unknown[]) => mockCreateOnboarding(...args),
    cancelOnboarding: (...args: unknown[]) => mockCancelOnboarding(...args),
  })),
}));

jest.mock("./api-client", () => ({
  getRegTankAPIClient: () => ({
    setOnboardingSettings: (...args: unknown[]) => mockSetOnboardingSettings(...args),
    setWebhookPreferences: (...args: unknown[]) => mockSetWebhookPreferences(...args),
    createIndividualOnboarding: (...args: unknown[]) => mockCreateIndividualOnboarding(...args),
    restartOnboarding: (...args: unknown[]) => mockRestartOnboarding(...args),
    createCorporateOnboarding: (...args: unknown[]) => mockCreateCorporateOnboarding(...args),
    getOnboardingDetails: (...args: unknown[]) => mockGetOnboardingDetails(...args),
  }),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: (...args: unknown[]) => mockFindIssuerOrganizationById(...args),
    updateInvestorOrganizationOnboarding: (...args: unknown[]) =>
      mockUpdateInvestorOrganizationOnboarding(...args),
  })),
}));

jest.mock("../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    createOnboardingLog: (...args: unknown[]) => mockCreateOnboardingLog(...args),
  })),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    onboardingLog: {
      create: (...args: unknown[]) => mockOnboardingLogCreate(...args),
    },
  },
}));

jest.mock("../payment/onboarding-fee-service", () => ({
  assertIssuerOnboardingFeePaid: jest.fn(),
}));

jest.mock("../../config/regtank", () => ({
  getRegTankConfig: () => ({
    redirectUrlInvestor: "https://investor.example.com",
    redirectUrlIssuer: "https://issuer.example.com",
  }),
}));

import { RegTankService } from "./service";

const nowPlus = (ms: number): Date => new Date(Date.now() + ms);
const nowMinus = (ms: number): Date => new Date(Date.now() - ms);

const makeUser = () => ({
  user_id: "USR01",
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
});

const makePersonalOrg = (status: OnboardingStatus = OnboardingStatus.IN_PROGRESS) => ({
  id: "org1",
  owner_user_id: "USR01",
  type: OrganizationType.PERSONAL,
  name: "Personal Org",
  onboarding_status: status,
  tnc_accepted: true,
});

const makeExistingRow = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "rt_old",
  request_id: "LD0001",
  status: "URL_GENERATED",
  verify_link: "https://masked.old.link",
  verify_link_expires_at: nowPlus(60_000),
  organization_type: OrganizationType.PERSONAL,
  onboarding_type: "INDIVIDUAL",
  ...overrides,
});

const makeReq = () =>
  ({
    headers: {},
    ip: "127.0.0.1",
  }) as never;

describe("RegTankService.startPersonalOnboarding stale-link handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(makeUser());
    mockFindInvestorOrganizationById.mockResolvedValue(makePersonalOrg());
    mockFindIssuerOrganizationById.mockResolvedValue(null);
    mockFindByOrganizationId.mockResolvedValue(null);
    mockCreateIndividualOnboarding.mockResolvedValue({
      requestId: "LD_NEW",
      verifyLink: "https://masked.new.link",
      expiredIn: 86400,
    });
    mockRestartOnboarding.mockResolvedValue({
      requestId: "LD0001-R01",
      verifyLink: "https://masked.restart.link?requestId=LD0001-R01",
      expiredIn: 86400,
    });
    mockGetOnboardingDetails.mockResolvedValue({
      requestId: "LD0001",
      status: "PROCESSING",
    });
    mockCreateOnboarding.mockResolvedValue({});
    mockCancelOnboarding.mockResolvedValue({});
  });

  it("reuses active unexpired link", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
      })
    );

    const service = new RegTankService();
    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(result.requestId).toBe("LD0001");
    expect(result.verifyLink).toContain("masked.old.link");
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
    expect(mockGetOnboardingDetails).toHaveBeenCalledWith("LD0001");
  });

  it("active revision LD83641-R03 query returns PROCESSING and reuses existing link", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        request_id: "LD83641-R03",
        status: "PROCESSING",
        verify_link: "https://masked.old.link?requestId=LD83641-R03",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockResolvedValue({
      requestId: "LD83641-R03",
      status: "PROCESSING",
    });

    const service = new RegTankService();
    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(result.requestId).toBe("LD83641-R03");
    expect(result.verifyLink).toContain("requestId=LD83641-R03");
    expect(mockGetOnboardingDetails).toHaveBeenCalledWith("LD83641-R03");
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
  });

  it("repeated Continue on active revision does not create R04", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        request_id: "LD83641-R03",
        status: "PROCESSING",
        verify_link: "https://masked.old.link?requestId=LD83641-R03",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockResolvedValue({
      requestId: "LD83641-R03",
      status: "PROCESSING",
    });

    const service = new RegTankService();
    const first = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");
    const second = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(first.requestId).toBe("LD83641-R03");
    expect(second.requestId).toBe("LD83641-R03");
    expect(mockGetOnboardingDetails).toHaveBeenCalledTimes(2);
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
  });

  it("provider not-found during pre-check triggers restart", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockRejectedValue(
      new AppError(404, "REGTANK_API_ERROR", "LD0001 not Found")
    );

    const service = new RegTankService();
    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
    expect(result.requestId).toBe("LD0001-R01");
    expect(result.verifyLink).toBe("https://masked.restart.link?requestId=LD0001-R01");
    expect(result.verifyLink).not.toBe("https://masked.old.link");
  });

  it.each(["EXPIRED", "CANCELLED", "ENDED", "INVALID"])(
    "provider %s status during pre-check triggers restart",
    async (providerStatus) => {
      mockFindByOrganizationId.mockResolvedValue(
        makeExistingRow({
          status: "PROCESSING",
          verify_link_expires_at: nowPlus(120_000),
        })
      );
      mockGetOnboardingDetails.mockResolvedValue({
        requestId: "LD0001",
        status: providerStatus,
      });

      const service = new RegTankService();
      const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

      expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
      expect(result.requestId).toBe("LD0001-R01");
      expect(result.verifyLink).toBe("https://masked.restart.link?requestId=LD0001-R01");
    }
  );

  it("provider protected status does not auto-restart", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockResolvedValue({
      requestId: "LD0001",
      status: "WAIT_FOR_APPROVAL",
    });

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
  });

  it("returns restarted link (not old link) before frontend redirect use", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
        verify_link: "https://masked.old.link",
      })
    );
    mockGetOnboardingDetails.mockRejectedValue(
      new AppError(404, "REGTANK_API_ERROR", "request not found")
    );

    const service = new RegTankService();
    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(result.verifyLink).toBe("https://masked.restart.link?requestId=LD0001-R01");
    expect(result.verifyLink).not.toBe("https://masked.old.link");
  });

  it("provider timeout returns retryable error without reuse or restart", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockRejectedValue(
      new AppError(408, "REGTANK_REQUEST_FAILED", "request timeout")
    );

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: "REGTANK_STATUS_CHECK_UNAVAILABLE",
      message: "We could not verify your onboarding status with RegTank. Please try again shortly.",
    });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
  });

  it("provider 500 returns retryable error without reuse or restart", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockRejectedValue(
      new AppError(500, "REGTANK_API_ERROR", "upstream error")
    );

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: "REGTANK_STATUS_CHECK_UNAVAILABLE",
    });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
  });

  it("provider 503 returns retryable error without reuse or restart", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockRejectedValue(
      new AppError(503, "REGTANK_API_ERROR", "service unavailable")
    );

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: "REGTANK_STATUS_CHECK_UNAVAILABLE",
    });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
  });

  it("malformed provider response returns retryable error without reuse or restart", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockResolvedValue({
      requestId: "LD0001",
    });

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: "REGTANK_STATUS_CHECK_UNAVAILABLE",
    });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
  });

  it("temporary provider failure keeps old row unchanged even when row is old", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
        created_at: nowMinus(10 * 24 * 60 * 60 * 1000),
      })
    );
    mockGetOnboardingDetails.mockRejectedValue(
      new AppError(503, "REGTANK_API_ERROR", "service unavailable")
    );

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({
      code: "REGTANK_STATUS_CHECK_UNAVAILABLE",
    });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
  });

  it("restart response requestId/verifyLink mismatch is handled safely", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "EXPIRED",
        verify_link_expires_at: nowMinus(1_000),
      })
    );
    mockRestartOnboarding.mockResolvedValue({
      requestId: "LD0001-R01",
      verifyLink: "https://masked.restart.link?requestId=LD0001-R02",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: "REGTANK_RESTART_RESPONSE_MISMATCH",
    });
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
  });

  it("expired link triggers one restart and returns new link", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "URL_GENERATED",
        verify_link_expires_at: nowMinus(60_000),
      })
    );

    const service = new RegTankService();
    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
    expect(mockRestartOnboarding).toHaveBeenCalledWith("LD0001");
    expect(result.requestId).toBe("LD0001-R01");
    expect(result.verifyLink).toContain("masked.restart.link");
    expect(result.verifyLink).toContain("requestId=LD0001-R01");
  });

  it("marks old row CANCELLED when auto-restarting", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "EXPIRED",
        verify_link_expires_at: nowMinus(1_000),
      })
    );

    const service = new RegTankService();
    await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(mockCancelOnboarding).toHaveBeenCalledTimes(1);
    expect(mockCancelOnboarding).toHaveBeenCalledWith(
      "rt_old",
      expect.stringContaining("Auto-restarted due to stale/expired link")
    );
  });

  it("creates new row on restart with same investor organization", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "EXPIRED",
        verify_link_expires_at: nowMinus(1_000),
      })
    );

    const service = new RegTankService();
    await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(mockCreateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "USR01",
        organizationId: "org1",
        portalType: "investor",
        requestId: "LD0001-R01",
        onboardingType: "INDIVIDUAL",
        organizationType: OrganizationType.PERSONAL,
      })
    );
  });

  it("never resumes CANCELLED row", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "CANCELLED",
        verify_link_expires_at: nowPlus(60_000),
      })
    );

    const service = new RegTankService();
    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(result.requestId).toBe("LD0001-R01");
    expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
  });

  it("never resumes EXPIRED row", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "EXPIRED",
        verify_link_expires_at: nowPlus(60_000),
      })
    );

    const service = new RegTankService();
    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(result.requestId).toBe("LD0001-R01");
    expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
  });

  it("does not auto-restart APPROVED", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "APPROVED",
        verify_link_expires_at: nowMinus(1_000),
      })
    );

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
  });

  it("does not auto-restart REJECTED", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "REJECTED",
        verify_link_expires_at: nowMinus(1_000),
      })
    );

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
  });

  it("does not auto-restart COMPLETED", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue(makePersonalOrg(OnboardingStatus.COMPLETED));

    const service = new RegTankService();
    await expect(
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor")
    ).rejects.toMatchObject<AppError>({ code: "ALREADY_COMPLETED" });
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
  });

  it("treats null expiry as non-reusable and restarts", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "URL_GENERATED",
        verify_link_expires_at: null,
      })
    );

    const service = new RegTankService();
    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(result.requestId).toBe("LD0001-R01");
    expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
  });

  it("repeated concurrent clicks create only one restart attempt", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "EXPIRED",
        verify_link_expires_at: nowMinus(1_000),
      })
    );
    mockRestartOnboarding.mockImplementation(
      async () =>
        await new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                requestId: "LD0001-R01",
                verifyLink: "https://masked.restart.link?requestId=LD0001-R01",
                expiredIn: 86400,
              }),
            15
          )
        )
    );

    const service = new RegTankService();
    await Promise.all([
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor"),
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor"),
    ]);

    expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
    expect(mockCancelOnboarding).toHaveBeenCalledTimes(1);
    expect(mockCreateOnboarding).toHaveBeenCalledTimes(1);
  });

  it("single-flight keeps one provider pre-check on temporary concurrent failure", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({
        status: "PROCESSING",
        verify_link_expires_at: nowPlus(120_000),
      })
    );
    mockGetOnboardingDetails.mockRejectedValue(
      new AppError(503, "REGTANK_API_ERROR", "service unavailable")
    );

    const service = new RegTankService();
    const [first, second] = await Promise.allSettled([
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor"),
      service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor"),
    ]);

    expect(first.status).toBe("rejected");
    expect(second.status).toBe("rejected");
    expect(mockGetOnboardingDetails).toHaveBeenCalledTimes(1);
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
    expect(mockCancelOnboarding).not.toHaveBeenCalled();
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
  });

  it("reuses newer active attempt and does not create another restart", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(
        makeExistingRow({
          id: "rt_old",
          request_id: "LD0001",
          status: "EXPIRED",
          verify_link_expires_at: nowMinus(1_000),
        })
      )
      .mockResolvedValueOnce(
        makeExistingRow({
          id: "rt_new",
          request_id: "LD0001-R01",
          status: "URL_GENERATED",
          verify_link: "https://masked.restart.link",
          verify_link_expires_at: nowPlus(120_000),
        })
      );

    const service = new RegTankService();
    await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");
    const second = await service.startPersonalOnboarding(makeReq(), "USR01", "org1", "investor");

    expect(second.requestId).toBe("LD0001-R01");
    expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
  });

  it("keeps corporate onboarding behavior unchanged", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "corp-org",
      owner_user_id: "USR01",
      type: OrganizationType.COMPANY,
      name: "Corp Org",
      onboarding_status: OnboardingStatus.PENDING,
      tnc_accepted: true,
    });
    mockFindByOrganizationId.mockResolvedValue(null);
    mockCreateCorporateOnboarding.mockResolvedValue({
      requestId: "COD0001",
      verifyLink: "https://masked.corp.link?requestId=COD0001",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    const result = await service.startCorporateOnboarding(
      makeReq(),
      "USR01",
      "corp-org",
      "investor",
      "Corp Org"
    );

    expect(result.requestId).toBe("COD0001");
    expect(mockCreateCorporateOnboarding).toHaveBeenCalledTimes(1);
    expect(mockRestartOnboarding).not.toHaveBeenCalled();
  });
});
