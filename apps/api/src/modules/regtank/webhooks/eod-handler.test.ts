import { OrganizationType } from "@prisma/client";

const mockAppendWebhookPayload = jest.fn().mockResolvedValue(undefined);
jest.mock("../repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    appendWebhookPayload: (...args: unknown[]) => mockAppendWebhookPayload(...args),
  })),
}));

const mockCreateOnboardingLog = jest.fn();
jest.mock("../../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    createOnboardingLog: (...args: unknown[]) => mockCreateOnboardingLog(...args),
  })),
}));

const mockFindInvestorOrganizationById = jest.fn();
jest.mock("../../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: jest.fn(),
  })),
}));

jest.mock("../aml-identity-repository", () => ({
  AmlIdentityRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../api-client", () => ({
  getRegTankAPIClient: () => ({
    getEntityOnboardingDetails: jest.fn(),
    getCorporateOnboardingDetails: jest.fn(),
    queryKYCStatus: jest.fn(),
  }),
}));

const mockRegTankOnboardingFindMany = jest.fn();
jest.mock("../../../lib/prisma", () => ({
  prisma: {
    regTankOnboarding: { findMany: (...args: unknown[]) => mockRegTankOnboardingFindMany(...args) },
    investorOrganization: { findUnique: jest.fn(), update: jest.fn() },
    issuerOrganization: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { EODWebhookHandler } from "./eod-handler";

function cancelledParentCod(eodRequestId: string) {
  return {
    id: "row-1",
    request_id: "COD001",
    status: "CANCELLED",
    onboarding_type: "CORPORATE",
    organization_type: OrganizationType.COMPANY,
    investor_organization_id: "org-1",
    issuer_organization_id: null,
    portal_type: "investor",
    user_id: "user-1",
    webhook_payloads: [
      {
        corpIndvDirectors: [eodRequestId],
        corpIndvShareholders: [],
        corpBizShareholders: [],
      },
    ],
  };
}

function liveParentCod(eodRequestId: string) {
  return {
    ...cancelledParentCod(eodRequestId),
    status: "IN_PROGRESS",
    investor_organization: { id: "org-1", name: "Live Corp", type: OrganizationType.COMPANY },
    issuer_organization: null,
  };
}

describe("EODWebhookHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("E10: a cancelled parent COD preserves the EOD payload but prevents organization/party mutation", async () => {
    mockRegTankOnboardingFindMany.mockResolvedValue([cancelledParentCod("EOD001")]);
    const handler = new EODWebhookHandler();

    await (handler as any).handle({
      requestId: "EOD001",
      status: "APPROVED",
      confidence: 0.9,
    });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith("COD001", expect.objectContaining({ requestId: "EOD001" }));
    expect(mockCreateOnboardingLog).not.toHaveBeenCalled();
    expect(mockFindInvestorOrganizationById).not.toHaveBeenCalled();
  });

  it("records EOD activity as a webhook integration, not as the applicant", async () => {
    mockRegTankOnboardingFindMany.mockResolvedValue([liveParentCod("EOD002")]);
    mockFindInvestorOrganizationById.mockResolvedValue(null);
    mockCreateOnboardingLog.mockResolvedValue({});
    const handler = new EODWebhookHandler();

    await (handler as any).handle({
      requestId: "EOD002",
      status: "PENDING",
      confidence: 0.4,
      kycId: "kyc-1",
    });

    expect(mockCreateOnboardingLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        eventType: "EOD_WEBHOOK",
        context: expect.objectContaining({
          source: "WEBHOOK",
          actorType: "INTEGRATION",
          actorUserId: null,
          portal: null,
        }),
      })
    );
    expect(mockCreateOnboardingLog.mock.calls[0][0].portal).toBeUndefined();
  });
});
