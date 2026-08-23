import { OnboardingStatus, OrganizationType } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

const mockFindByOrganizationId = jest.fn();
const mockCreateOnboarding = jest.fn();

const mockSetOnboardingSettings = jest.fn().mockResolvedValue(undefined);
const mockCreateCorporateOnboarding = jest.fn();
const mockGetCorporateOnboardingDetails = jest.fn();
const mockRestartOnboarding = jest.fn();

const mockFindInvestorOrganizationById = jest.fn();
const mockFindIssuerOrganizationById = jest.fn();

const mockUserFindUnique = jest.fn();
const mockOnboardingAuditCreate = jest.fn().mockResolvedValue(undefined);
const mockTxUpdate = jest.fn().mockResolvedValue(undefined);
const mockTxCreate = jest.fn().mockResolvedValue(undefined);
const mockPrismaTransaction = jest.fn();

jest.mock("./repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findByOrganizationId: (...args: unknown[]) => mockFindByOrganizationId(...args),
    createOnboarding: (...args: unknown[]) => mockCreateOnboarding(...args),
  })),
}));

jest.mock("./api-client", () => ({
  getRegTankAPIClient: () => ({
    setOnboardingSettings: (...args: unknown[]) => mockSetOnboardingSettings(...args),
    createCorporateOnboarding: (...args: unknown[]) => mockCreateCorporateOnboarding(...args),
    getCorporateOnboardingDetails: (...args: unknown[]) => mockGetCorporateOnboardingDetails(...args),
    restartOnboarding: (...args: unknown[]) => mockRestartOnboarding(...args),
  }),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: (...args: unknown[]) => mockFindIssuerOrganizationById(...args),
  })),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    onboardingAuditLog: {
      create: (...args: unknown[]) => mockOnboardingAuditCreate(...args),
    },
    issuerOrganization: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const org = await mockFindIssuerOrganizationById(where.id);
        if (!org) return null;
        return {
          id: org.id,
          onboarding_fee_paid_at: org.onboarding_fee_paid_at ?? null,
        };
      }),
    },
    gatewayPayment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
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

const makeReq = () =>
  ({
    headers: {},
    ip: "127.0.0.1",
  }) as never;

const makeCompanyOrg = (status: OnboardingStatus = OnboardingStatus.IN_PROGRESS) => ({
  id: "org-company-1",
  owner_user_id: "USR01",
  type: OrganizationType.COMPANY,
  name: "Company Org",
  onboarding_status: status,
  tnc_accepted: true,
});

const makeExistingRow = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "rt_cod_old",
  request_id: "COD0001",
  status: "PENDING",
  verify_link: "https://masked.company.old.link",
  verify_link_expires_at: nowPlus(60_000),
  organization_type: OrganizationType.COMPANY,
  onboarding_type: "CORPORATE",
  ...overrides,
});

describe("RegTankService.startCorporateOnboarding company auto-regeneration", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockFindInvestorOrganizationById.mockResolvedValue(makeCompanyOrg());
    mockFindIssuerOrganizationById.mockResolvedValue(null);

    mockFindByOrganizationId.mockResolvedValue(null);
    mockCreateOnboarding.mockImplementation(async (data: { requestId?: string }) => ({
      id: "rt_created",
      request_id: data.requestId ?? "COD0002",
    }));

    mockUserFindUnique.mockResolvedValue({
      user_id: "USR01",
      email: "corp@test.com",
      first_name: "Corp",
      last_name: "User",
    });

    mockCreateCorporateOnboarding.mockResolvedValue({
      requestId: "COD0002",
      verifyLink: "https://masked.company.new.link?requestId=COD0002",
      expiredIn: 86400,
    });

    mockGetCorporateOnboardingDetails.mockResolvedValue({
      requestId: "COD0001",
      status: "URL_GENERATED",
    });

    mockPrismaTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        user: {
          findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
        },
        onboardingAuditLog: {
          create: (...args: unknown[]) => mockOnboardingAuditCreate(...args),
        },
        regTankOnboarding: {
          update: (...args: unknown[]) => mockTxUpdate(...args),
          create: (...args: unknown[]) => mockTxCreate(...args),
        },
      })
    );
  });

  it("locally active/unexpired + provider active reuses existing link", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
    );

    const service = new RegTankService();
    const result = await service.startCorporateOnboarding(
      makeReq(),
      "USR01",
      "org-company-1",
      "investor",
      "Company Org"
    );

    expect(result.requestId).toBe("COD0001");
    expect(mockGetCorporateOnboardingDetails).toHaveBeenCalledWith("COD0001");
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("provider not found triggers regeneration", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      )
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      );
    mockGetCorporateOnboardingDetails.mockRejectedValue(
      new AppError(404, "REGTANK_API_ERROR", "COD0001 not Found")
    );

    const service = new RegTankService();
    const result = await service.startCorporateOnboarding(
      makeReq(),
      "USR01",
      "org-company-1",
      "investor",
      "Company Org"
    );

    expect(result.requestId).toBe("COD0002");
    expect(mockCreateCorporateOnboarding).toHaveBeenCalledTimes(1);
  });

  it.each(["EXPIRED", "CANCELLED", "ENDED", "INVALID"])(
    "provider %s triggers regeneration",
    async (providerStatus) => {
      mockFindByOrganizationId
        .mockResolvedValueOnce(
          makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
        )
        .mockResolvedValueOnce(
          makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
        );
      mockGetCorporateOnboardingDetails.mockResolvedValue({
        requestId: "COD0001",
        status: providerStatus,
      });

      const service = new RegTankService();
      const result = await service.startCorporateOnboarding(
        makeReq(),
        "USR01",
        "org-company-1",
        "investor",
        "Company Org"
      );

      expect(result.requestId).toBe("COD0002");
      expect(mockCreateCorporateOnboarding).toHaveBeenCalledTimes(1);
    }
  );

  it("protected provider status returns protected-state error", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      )
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      );
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      requestId: "COD0001",
      status: "WAIT_FOR_APPROVAL",
    });

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
  });

  it("protected organization status skips provider check and regeneration", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue(makeCompanyOrg(OnboardingStatus.PENDING_AML));
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "PENDING" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
    expect(mockGetCorporateOnboardingDetails).not.toHaveBeenCalled();
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
  });

  it("locally expired still regenerates directly without provider status call", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "PENDING", verify_link_expires_at: null }))
      .mockResolvedValueOnce(makeExistingRow({ status: "PENDING", verify_link_expires_at: null }));

    const service = new RegTankService();
    await service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org");

    expect(mockGetCorporateOnboardingDetails).not.toHaveBeenCalled();
    expect(mockCreateCorporateOnboarding).toHaveBeenCalledTimes(1);
  });

  it("missing verify_link creates one new COD request", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "PENDING", verify_link: null }))
      .mockResolvedValueOnce(makeExistingRow({ status: "PENDING", verify_link: null }));

    const service = new RegTankService();
    await service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org");

    expect(mockCreateCorporateOnboarding).toHaveBeenCalledTimes(1);
  });

  it("CANCELLED row is not reused", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "CANCELLED", verify_link_expires_at: nowPlus(60_000) }))
      .mockResolvedValueOnce(makeExistingRow({ status: "CANCELLED", verify_link_expires_at: nowPlus(60_000) }));

    const service = new RegTankService();
    const result = await service.startCorporateOnboarding(
      makeReq(),
      "USR01",
      "org-company-1",
      "investor",
      "Company Org"
    );

    expect(result.requestId).toBe("COD0002");
    expect(mockCreateCorporateOnboarding).toHaveBeenCalledTimes(1);
  });

  it("EXPIRED row is not reused", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED", verify_link_expires_at: nowPlus(60_000) }))
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED", verify_link_expires_at: nowPlus(60_000) }));

    const service = new RegTankService();
    await service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org");

    expect(mockCreateCorporateOnboarding).toHaveBeenCalledTimes(1);
  });

  it("APPROVED does not auto-generate", async () => {
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "APPROVED" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
  });

  it("REJECTED does not auto-generate", async () => {
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "REJECTED" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
  });

  it("COMPLETED does not auto-generate", async () => {
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "COMPLETED" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
  });

  it("PENDING_APPROVAL does not auto-generate", async () => {
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "PENDING_APPROVAL" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
  });

  it("WAIT_FOR_APPROVAL does not auto-generate", async () => {
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "WAIT_FOR_APPROVAL" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
  });

  it("PENDING_SSM_REVIEW does not auto-generate", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue(makeCompanyOrg(OnboardingStatus.PENDING_SSM_REVIEW));
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "PENDING" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
  });

  it("PENDING_AML does not auto-generate", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue(makeCompanyOrg(OnboardingStatus.PENDING_AML));
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "PENDING" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
  });

  it("PENDING_FINAL_APPROVAL does not auto-generate", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue(makeCompanyOrg(OnboardingStatus.PENDING_FINAL_APPROVAL));
    mockFindByOrganizationId.mockResolvedValue(makeExistingRow({ status: "PENDING" }));

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "INVALID_STATE" });
  });

  it("old row becomes CANCELLED after successful regeneration", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "PENDING", verify_link_expires_at: nowMinus(1_000) }))
      .mockResolvedValueOnce(makeExistingRow({ status: "PENDING", verify_link_expires_at: nowMinus(1_000) }));

    const service = new RegTankService();
    await service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org");

    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt_cod_old" },
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
  });

  it("new row uses same investor organization", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED" }))
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED" }));

    const service = new RegTankService();
    await service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org");

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          investor_organization_id: "org-company-1",
          user_id: "USR01",
          organization_type: OrganizationType.COMPANY,
          onboarding_type: "CORPORATE",
        }),
      })
    );
  });

  it("new row uses same issuer organization for issuer portal", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue(null);
    mockFindIssuerOrganizationById.mockResolvedValue({
      id: "org-issuer-company-1",
      owner_user_id: "USR01",
      type: OrganizationType.COMPANY,
      name: "Issuer Company Org",
      onboarding_status: OnboardingStatus.IN_PROGRESS,
      onboarding_fee_paid_at: new Date(),
    });
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED", request_id: "COD1001" }))
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED", request_id: "COD1001" }));
    mockCreateCorporateOnboarding.mockResolvedValue({
      requestId: "COD1002",
      verifyLink: "https://masked.company.new.link?requestId=COD1002",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    await service.startCorporateOnboarding(
      makeReq(),
      "USR01",
      "org-issuer-company-1",
      "issuer",
      "Issuer Company Org"
    );

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issuer_organization_id: "org-issuer-company-1",
          investor_organization_id: null,
          user_id: "USR01",
          organization_type: OrganizationType.COMPANY,
          onboarding_type: "CORPORATE",
          portal_type: "issuer",
        }),
      })
    );
  });

  it("new row stores returned COD request ID and verify link", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED" }))
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED" }));

    const service = new RegTankService();
    await service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org");

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          request_id: "COD0002",
          verify_link: "https://masked.company.new.link?requestId=COD0002",
        }),
      })
    );
  });

  it("concurrent clicks result in one /corp/request call", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      )
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      );
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      requestId: "COD0001",
      status: "EXPIRED",
    });

    mockCreateCorporateOnboarding.mockImplementation(
      async () =>
        await new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                requestId: "COD0002",
                verifyLink: "https://masked.company.new.link?requestId=COD0002",
                expiredIn: 86400,
              }),
            20
          )
        )
    );

    const service = new RegTankService();
    await Promise.all([
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org"),
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org"),
    ]);

    expect(mockGetCorporateOnboardingDetails).toHaveBeenCalledTimes(1);
    expect(mockCreateCorporateOnboarding).toHaveBeenCalledTimes(1);
  });

  it("concurrent callers receive the same resulting link", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      )
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      );
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      requestId: "COD0001",
      status: "EXPIRED",
    });

    const service = new RegTankService();
    const [a, b] = await Promise.all([
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org"),
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org"),
    ]);

    expect(a.verifyLink).toBe(b.verifyLink);
    expect(a.requestId).toBe(b.requestId);
  });

  it("reuses newer valid row if it appears during protected operation", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(
        makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
      )
      .mockResolvedValueOnce(
        makeExistingRow({
          id: "rt_cod_new",
          request_id: "COD0009",
          status: "URL_GENERATED",
          verify_link: "https://masked.company.newer.link",
          verify_link_expires_at: nowPlus(120_000),
        })
      );
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      requestId: "COD0001",
      status: "EXPIRED",
    });

    const service = new RegTankService();
    const result = await service.startCorporateOnboarding(
      makeReq(),
      "USR01",
      "org-company-1",
      "investor",
      "Company Org"
    );

    expect(result.requestId).toBe("COD0009");
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
  });

  it("new company onboarding response requestId/link mismatch returns retryable 503", async () => {
    mockFindByOrganizationId.mockResolvedValue(null);
    mockCreateCorporateOnboarding.mockResolvedValue({
      requestId: "COD0002",
      verifyLink: "https://masked.company.new.link?requestId=COD0009",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({
      code: "REGTANK_CORPORATE_RESPONSE_MISMATCH",
      statusCode: 503,
    });
    expect(mockCreateOnboarding).not.toHaveBeenCalled();
  });

  it("company regeneration response requestId/link mismatch returns retryable 503 without mutating old row", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED" }))
      .mockResolvedValueOnce(makeExistingRow({ status: "EXPIRED" }));
    mockCreateCorporateOnboarding.mockResolvedValue({
      requestId: "COD0002",
      verifyLink: "https://masked.company.new.link?requestId=COD0007",
      expiredIn: 86400,
    });

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({
      code: "REGTANK_CORPORATE_RESPONSE_MISMATCH",
      statusCode: 503,
    });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
  });

  it.each([
    new AppError(408, "REGTANK_API_ERROR", "Timeout"),
    new AppError(500, "REGTANK_API_ERROR", "Internal server error"),
    new AppError(503, "REGTANK_API_ERROR", "Service unavailable"),
    new AppError(500, "REGTANK_REQUEST_FAILED", "Network failure"),
  ])("provider temporary failure returns retryable 503 (%s)", async (providerError) => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
    );
    mockGetCorporateOnboardingDetails.mockRejectedValue(providerError);

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "REGTANK_STATUS_CHECK_UNAVAILABLE", statusCode: 503 });
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
  });

  it("malformed provider response returns retryable 503", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
    );
    mockGetCorporateOnboardingDetails.mockResolvedValue({ requestId: "COD0001" });

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "REGTANK_STATUS_CHECK_UNAVAILABLE", statusCode: 503 });
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
  });

  it("unknown provider status returns retryable 503", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
    );
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      requestId: "COD0001",
      status: "SOME_NEW_UNKNOWN_STATUS",
    });

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "REGTANK_STATUS_CHECK_UNAVAILABLE", statusCode: 503 });
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
  });

  it("mismatched provider requestId returns retryable 503", async () => {
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
    );
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      requestId: "COD9999",
      status: "URL_GENERATED",
    });

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toMatchObject<AppError>({ code: "REGTANK_STATUS_CHECK_UNAVAILABLE", statusCode: 503 });
    expect(mockCreateCorporateOnboarding).not.toHaveBeenCalled();
  });

  it("/corp/request failure keeps old row unchanged (no partial local write)", async () => {
    mockFindByOrganizationId
      .mockResolvedValueOnce(makeExistingRow({ status: "PENDING", verify_link_expires_at: nowMinus(1_000) }))
      .mockResolvedValueOnce(makeExistingRow({ status: "PENDING", verify_link_expires_at: nowMinus(1_000) }));
    mockCreateCorporateOnboarding.mockRejectedValue(
      new AppError(500, "REGTANK_API_ERROR", "RegTank unavailable")
    );

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(makeReq(), "USR01", "org-company-1", "investor", "Company Org")
    ).rejects.toBeInstanceOf(AppError);
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
  });

  it("personal onboarding behavior remains unchanged", async () => {
    const service = new RegTankService();
    const fn = jest.spyOn(service, "startPersonalOnboarding").mockResolvedValue({
      requestId: "LD001",
      verifyLink: "https://masked.personal.link",
      expiresIn: 86400,
      organizationType: OrganizationType.PERSONAL,
    });

    const result = await service.startPersonalOnboarding(makeReq(), "USR01", "org-personal-1", "investor");
    expect(result.requestId).toBe("LD001");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("allows an organization member to start corporate verification", async () => {
    mockFindInvestorOrganizationById.mockResolvedValue({
      ...makeCompanyOrg(),
      members: [{ user_id: "MEM01" }],
    });
    mockFindByOrganizationId.mockResolvedValue(
      makeExistingRow({ status: "URL_GENERATED", verify_link_expires_at: nowPlus(120_000) })
    );
    mockUserFindUnique.mockResolvedValue({
      user_id: "MEM01",
      email: "member@test.com",
      first_name: "Org",
      last_name: "Member",
    });

    const service = new RegTankService();
    const result = await service.startCorporateOnboarding(
      makeReq(),
      "MEM01",
      "org-company-1",
      "investor",
      "Company Org"
    );

    expect(result.requestId).toBe("COD0001");
  });
});
