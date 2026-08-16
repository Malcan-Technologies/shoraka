import { OrganizationType } from "@prisma/client";

const mockFindByRequestId = jest.fn();
const mockAppendWebhookPayload = jest.fn().mockResolvedValue(undefined);
const mockUpdateStatus = jest.fn().mockResolvedValue({});

jest.mock("../repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findByRequestId: (...args: unknown[]) => mockFindByRequestId(...args),
    appendWebhookPayload: (...args: unknown[]) => mockAppendWebhookPayload(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  })),
}));

const mockUpdateInvestorOrganizationOnboarding = jest.fn();
const mockUpdateIssuerOrganizationOnboarding = jest.fn();
jest.mock("../../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: jest.fn(),
    findIssuerOrganizationById: jest.fn(),
    updateInvestorOrganizationOnboarding: (...args: unknown[]) => mockUpdateInvestorOrganizationOnboarding(...args),
    updateIssuerOrganizationOnboarding: (...args: unknown[]) => mockUpdateIssuerOrganizationOnboarding(...args),
  })),
}));

jest.mock("../aml-identity-repository", () => ({
  AmlIdentityRepository: jest.fn().mockImplementation(() => ({
    bulkUpsert: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockGetCorporateOnboardingDetails = jest.fn();
const mockGetEntityOnboardingDetails = jest.fn();
jest.mock("../api-client", () => ({
  getRegTankAPIClient: () => ({
    getCorporateOnboardingDetails: (...args: unknown[]) => mockGetCorporateOnboardingDetails(...args),
    getEntityOnboardingDetails: (...args: unknown[]) => mockGetEntityOnboardingDetails(...args),
  }),
}));

jest.mock("../../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped: jest.fn(),
  })),
}));

const mockWriteOnboardingAuditLog = jest.fn();
jest.mock("../../onboarding/audit/writer", () => ({
  writeOnboardingAuditLog: (...args: unknown[]) => mockWriteOnboardingAuditLog(...args),
}));

const mockInvestorUpdate = jest.fn();
const mockIssuerUpdate = jest.fn();
const mockInvestorFindUnique = jest.fn();
const mockIssuerFindUnique = jest.fn();
const mockRegTankFindUnique = jest.fn();
const investorOrgClient = {
  update: (...args: unknown[]) => mockInvestorUpdate(...args),
  findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
};
const issuerOrgClient = {
  update: (...args: unknown[]) => mockIssuerUpdate(...args),
  findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
};
const txClient = {
  $queryRaw: jest.fn().mockResolvedValue([{ id: "org-1" }]),
  investorOrganization: investorOrgClient,
  issuerOrganization: issuerOrgClient,
};
jest.mock("../../../lib/prisma", () => ({
  prisma: {
    investorOrganization: investorOrgClient,
    issuerOrganization: issuerOrgClient,
    regTankOnboarding: { findUnique: (...args: unknown[]) => mockRegTankFindUnique(...args) },
    $transaction: async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient),
  },
}));

import { CODWebhookHandler } from "./cod-handler";

function baseOnboardingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    request_id: "COD001",
    status: "PENDING",
    onboarding_type: "CORPORATE",
    organization_type: OrganizationType.COMPANY,
    investor_organization_id: "org-1",
    issuer_organization_id: null,
    portal_type: "investor",
    user_id: "user-1",
    ...overrides,
  };
}

function minimalCodPayload(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "COD001",
    status: "WAIT_FOR_APPROVAL",
    isPrimary: true,
    corpIndvDirectors: [],
    corpIndvShareholders: [],
    corpBizShareholders: [],
    ...overrides,
  };
}

describe("CODWebhookHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("D7: acknowledges (does not throw) and performs no mutation for an unmatched COD requestId", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    const handler = new CODWebhookHandler();

    await expect((handler as any).handle(minimalCodPayload())).resolves.toBeUndefined();

    expect(mockFindByRequestId).toHaveBeenCalledTimes(3);
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(1, "COD001");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(2, "COD001");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(3, "COD001");
    expect(mockAppendWebhookPayload).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
    expect(mockUpdateInvestorOrganizationOnboarding).not.toHaveBeenCalled();
  });

  it("retries exact COD request lookup and processes once found", async () => {
    mockFindByRequestId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseOnboardingRow({ request_id: "COD001", status: "PENDING" }));
    const handler = new CODWebhookHandler();

    await expect(
      (handler as any).handle(minimalCodPayload({ requestId: "COD001", status: "PROCESSING" }))
    ).resolves.toBeUndefined();

    expect(mockFindByRequestId).toHaveBeenCalledTimes(2);
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(1, "COD001");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(2, "COD001");
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith(
      "COD001",
      expect.objectContaining({ requestId: "COD001", status: "PROCESSING" })
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD001",
      expect.objectContaining({ status: "PROCESSING" })
    );
  });

  it("never attaches a COD webhook to another requestId row", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow({ request_id: "COD999", status: "PENDING" }));
    const handler = new CODWebhookHandler();

    await expect(
      (handler as any).handle(minimalCodPayload({ requestId: "COD123", status: "PROCESSING" }))
    ).resolves.toBeUndefined();

    expect(mockFindByRequestId).toHaveBeenCalledTimes(1);
    expect(mockFindByRequestId).toHaveBeenCalledWith("COD123");
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith(
      "COD123",
      expect.objectContaining({ requestId: "COD123" })
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD123",
      expect.objectContaining({ status: "PROCESSING" })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith("COD999", expect.anything());
  });

  it("immediate exact match path remains unchanged (single lookup)", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow({ request_id: "COD001", status: "PENDING" }));
    const handler = new CODWebhookHandler();

    await expect(
      (handler as any).handle(minimalCodPayload({ requestId: "COD001", status: "PROCESSING" }))
    ).resolves.toBeUndefined();

    expect(mockFindByRequestId).toHaveBeenCalledTimes(1);
    expect(mockFindByRequestId).toHaveBeenCalledWith("COD001");
    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
  });

  it("E9: preserves the payload on a CANCELLED row, does not mutate the organization, and does not change status", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow({ status: "CANCELLED" }));
    const handler = new CODWebhookHandler();

    await (handler as any).handle(minimalCodPayload({ status: "APPROVED" }));

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith("COD001", expect.objectContaining({ status: "APPROVED" }));
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
    expect(mockUpdateInvestorOrganizationOnboarding).not.toHaveBeenCalled();
  });

  it("F13: a COD webhook cannot mutate a resolved INDIVIDUAL onboarding row (and is not appended to it)", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseOnboardingRow({ onboarding_type: "INDIVIDUAL", organization_type: OrganizationType.PERSONAL })
    );
    const handler = new CODWebhookHandler();

    await (handler as any).handle(minimalCodPayload());

    // Confirmed type mismatch: no append, no status change, no org mutation.
    expect(mockAppendWebhookPayload).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
    expect(mockUpdateInvestorOrganizationOnboarding).not.toHaveBeenCalled();
  });

  it("EXPIRED COD webhook updates the exact matching COD row to EXPIRED", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow({ request_id: "COD-A", status: "IN_PROGRESS" }));
    const handler = new CODWebhookHandler();

    await (handler as any).handle(minimalCodPayload({ requestId: "COD-A", status: "EXPIRED" }));

    expect(mockAppendWebhookPayload).toHaveBeenCalledWith(
      "COD-A",
      expect.objectContaining({ requestId: "COD-A", status: "EXPIRED" })
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD-A",
      expect.objectContaining({ status: "EXPIRED" })
    );
  });

  it("COD-A webhook updates only COD-A row", async () => {
    mockFindByRequestId.mockImplementation(async (requestId: string) =>
      requestId === "COD-A" ? baseOnboardingRow({ request_id: "COD-A" }) : null
    );
    const handler = new CODWebhookHandler();

    await (handler as any).handle(minimalCodPayload({ requestId: "COD-A", status: "PROCESSING" }));

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD-A",
      expect.objectContaining({ status: "PROCESSING" })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "COD-B",
      expect.anything()
    );
  });

  it("COD-B webhook updates only COD-B row", async () => {
    mockFindByRequestId.mockImplementation(async (requestId: string) =>
      requestId === "COD-B" ? baseOnboardingRow({ request_id: "COD-B" }) : null
    );
    const handler = new CODWebhookHandler();

    await (handler as any).handle(minimalCodPayload({ requestId: "COD-B", status: "PROCESSING" }));

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "COD-B",
      expect.objectContaining({ status: "PROCESSING" })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "COD-A",
      expect.anything()
    );
  });

  it("COD WAIT persists corporate entities and director KYC without entity or intermediate director audits", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseOnboardingRow({ status: "IN_PROGRESS", organization_type: OrganizationType.COMPANY })
    );
    mockInvestorFindUnique.mockResolvedValue({
      id: "org-1",
      type: OrganizationType.COMPANY,
      onboarding_status: "IN_PROGRESS",
      corporate_entities: null,
      director_kyc_status: { directors: [] },
      registration_number: null,
    });
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD001", status: "PENDING" },
          corporateUserRequestInfo: {
            fullName: "Ada",
            email: "ada@example.com",
            formContent: { content: [] },
          },
        },
      ],
      corpIndvShareholders: [],
      corpBizShareholders: [],
    });
    mockGetEntityOnboardingDetails.mockResolvedValue({
      corporateIndividualRequest: { status: "PENDING" },
    });

    const handler = new CODWebhookHandler();
    await (handler as any).handle(minimalCodPayload({ status: "WAIT_FOR_APPROVAL" }));

    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          corporate_entities: expect.anything(),
          director_kyc_status: expect.objectContaining({
            directors: expect.arrayContaining([
              expect.objectContaining({ eodRequestId: "EOD001" }),
            ]),
          }),
          onboarding_status: "PENDING_SSM_REVIEW",
        }),
      })
    );
    const auditTypes = mockWriteOnboardingAuditLog.mock.calls.map(
      (call) => (call[0] as { eventType: string }).eventType
    );
    expect(auditTypes).toEqual(["ONBOARDING_STATUS_CHANGED"]);
    expect(mockWriteOnboardingAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ONBOARDING_STATUS_CHANGED",
        metadata: expect.objectContaining({
          previousStatus: "IN_PROGRESS",
          newStatus: "PENDING_SSM_REVIEW",
        }),
      }),
      expect.anything()
    );
  });

  it("COD WAIT amendment resubmission writes one STATUS_CHANGED from PENDING_AMENDMENT", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseOnboardingRow({ status: "IN_PROGRESS", organization_type: OrganizationType.COMPANY })
    );
    mockInvestorFindUnique.mockResolvedValue({
      id: "org-1",
      type: OrganizationType.COMPANY,
      onboarding_status: "PENDING_AMENDMENT",
      corporate_entities: { directors: [] },
      director_kyc_status: { directors: [] },
      registration_number: null,
    });
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [],
      corpIndvShareholders: [],
      corpBizShareholders: [],
    });

    const handler = new CODWebhookHandler();
    await (handler as any).handle(minimalCodPayload({ status: "WAIT_FOR_APPROVAL" }));

    expect(mockWriteOnboardingAuditLog).toHaveBeenCalledTimes(1);
    expect(mockWriteOnboardingAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ONBOARDING_STATUS_CHANGED",
        metadata: expect.objectContaining({
          previousStatus: "PENDING_AMENDMENT",
          newStatus: "PENDING_SSM_REVIEW",
        }),
      }),
      expect.anything()
    );
  });

  it("COD URL_GENERATED moves review to PENDING_AMENDMENT and writes one STATUS_CHANGED", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseOnboardingRow({ status: "IN_PROGRESS", organization_type: OrganizationType.COMPANY })
    );
    mockInvestorFindUnique.mockResolvedValue({
      id: "org-1",
      onboarding_status: "PENDING_SSM_REVIEW",
      type: OrganizationType.COMPANY,
      ssm_approved: true,
    });
    mockRegTankFindUnique.mockResolvedValue({
      webhook_payloads: [
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-01T00:00:00.000Z" },
        { status: "URL_GENERATED", timestamp: "2026-01-02T00:00:00.000Z" },
      ],
    });

    const handler = new CODWebhookHandler();
    await (handler as any).handle(minimalCodPayload({ status: "URL_GENERATED" }));

    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onboarding_status: "PENDING_AMENDMENT" }),
      })
    );
    expect(mockWriteOnboardingAuditLog).toHaveBeenCalledTimes(1);
    expect(mockWriteOnboardingAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ONBOARDING_STATUS_CHANGED",
        metadata: expect.objectContaining({
          previousStatus: "PENDING_SSM_REVIEW",
          newStatus: "PENDING_AMENDMENT",
          trigger: "URL_GENERATED",
        }),
      }),
      expect.anything()
    );
  });
});
