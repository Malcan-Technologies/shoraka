import { OnboardingStatus, OrganizationType } from "@prisma/client";

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

const mockCreateOnboardingLog = jest.fn();
jest.mock("../../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    createOnboardingLog: (...args: unknown[]) => mockCreateOnboardingLog(...args),
  })),
}));

jest.mock("../aml-identity-repository", () => ({
  AmlIdentityRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../api-client", () => ({
  getRegTankAPIClient: () => ({
    getCorporateOnboardingDetails: jest.fn(),
  }),
}));

jest.mock("../../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped: jest.fn(),
    sendTypedAndLogSystem: jest.fn(),
  })),
}));

const mockInvestorUpdate = jest.fn();
const mockIssuerUpdate = jest.fn();
const mockInvestorFindUnique = jest.fn();
const mockIssuerFindUnique = jest.fn();
const mockCreateOnboardingLogRow = jest.fn();
jest.mock("../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        investorOrganization: {
          update: (...args: unknown[]) => mockInvestorUpdate(...args),
          findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
        },
        issuerOrganization: {
          update: (...args: unknown[]) => mockIssuerUpdate(...args),
          findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
        },
        onboardingLog: { create: jest.fn() },
      })
    ),
    investorOrganization: {
      update: (...args: unknown[]) => mockInvestorUpdate(...args),
      findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
    },
    issuerOrganization: {
      update: (...args: unknown[]) => mockIssuerUpdate(...args),
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
    },
    regTankOnboarding: { findUnique: jest.fn() },
  },
}));

jest.mock("../../../lib/audit", () => {
  const actual = jest.requireActual("../../../lib/audit");
  return {
    ...actual,
    createOnboardingLogRow: (...args: unknown[]) => mockCreateOnboardingLogRow(...args),
  };
});

import { prisma } from "../../../lib/prisma";
import { AUDIT_ACTOR_TYPE, AUDIT_SOURCE } from "../../../lib/audit";
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

  it("URL_GENERATED → PENDING_AMENDMENT logs previous/new status with webhook attribution", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseOnboardingRow({
        request_id: "COD001",
        status: "WAIT_FOR_APPROVAL",
        organization_type: OrganizationType.COMPANY,
      })
    );
    mockInvestorFindUnique.mockResolvedValue({
      id: "org-1",
      name: "Acme Sdn Bhd",
      onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW,
      type: OrganizationType.COMPANY,
      ssm_approved: true,
    });
    (prisma.regTankOnboarding.findUnique as jest.Mock).mockResolvedValue({
      webhook_payloads: [
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-01T00:00:00.000Z" },
        { status: "URL_GENERATED", timestamp: "2026-01-02T00:00:00.000Z" },
      ],
    });
    mockInvestorUpdate.mockResolvedValue({});
    mockCreateOnboardingLogRow.mockResolvedValue({ id: "log-1" });

    const handler = new CODWebhookHandler();
    await (handler as any).handle(minimalCodPayload({ requestId: "COD001", status: "URL_GENERATED" }));

    expect(mockInvestorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org-1" },
        data: expect.objectContaining({
          onboarding_status: OnboardingStatus.PENDING_AMENDMENT,
        }),
      })
    );
    expect(mockCreateOnboardingLogRow).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        eventType: "ONBOARDING_STATUS_UPDATED",
        context: expect.objectContaining({
          source: AUDIT_SOURCE.WEBHOOK,
          actorType: AUDIT_ACTOR_TYPE.INTEGRATION,
          actorUserId: null,
        }),
        metadata: expect.objectContaining({
          requestId: "COD001",
          providerStatus: "URL_GENERATED",
          previousStatus: OnboardingStatus.PENDING_SSM_REVIEW,
          newStatus: OnboardingStatus.PENDING_AMENDMENT,
          trigger: "COD_URL_GENERATED",
        }),
      }),
      expect.anything()
    );
    expect(mockCreateOnboardingLogRow).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ONBOARDING_AMENDMENT_REQUIRED",
        metadata: expect.objectContaining({
          organizationId: "org-1",
          previousStatus: OnboardingStatus.PENDING_SSM_REVIEW,
          newStatus: OnboardingStatus.PENDING_AMENDMENT,
        }),
      }),
      expect.anything()
    );
    const amendmentMeta = mockCreateOnboardingLogRow.mock.calls.find(
      (call) => (call[0] as { eventType?: string }).eventType === "ONBOARDING_AMENDMENT_REQUIRED"
    )?.[0] as { metadata: Record<string, unknown> };
    expect(amendmentMeta.metadata).not.toHaveProperty("requestId");
    expect(amendmentMeta.metadata).not.toHaveProperty("providerStatus");
  });
});
