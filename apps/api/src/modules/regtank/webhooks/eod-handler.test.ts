import { OrganizationType } from "@prisma/client";

const mockAppendWebhookPayload = jest.fn().mockResolvedValue(undefined);
jest.mock("../repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    appendWebhookPayload: (...args: unknown[]) => mockAppendWebhookPayload(...args),
  })),
}));

const mockWriteOnboardingAuditLog = jest.fn();
jest.mock("../../onboarding/audit/writer", () => ({
  writeOnboardingAuditLog: (...args: unknown[]) => mockWriteOnboardingAuditLog(...args),
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
let directorKyc: {
  directors: Array<{
    eodRequestId: string;
    name: string;
    email: string;
    role: string;
    kycStatus: string;
    kycId?: string;
    lastUpdated: string;
  }>;
} = { directors: [] };
let txChain = Promise.resolve();

const investorOrgClient = {
  findUnique: jest.fn(() => Promise.resolve({ director_kyc_status: directorKyc })),
  update: jest.fn(({ data }: { data: { director_kyc_status: typeof directorKyc } }) => {
    directorKyc = data.director_kyc_status;
    return Promise.resolve({});
  }),
};

const txClient = {
  $queryRaw: jest.fn(() => Promise.resolve([{ id: "org-1" }])),
  investorOrganization: investorOrgClient,
  issuerOrganization: { findUnique: jest.fn(), update: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    regTankOnboarding: { findMany: (...args: unknown[]) => mockRegTankOnboardingFindMany(...args) },
    investorOrganization: investorOrgClient,
    issuerOrganization: { findUnique: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn(() => Promise.resolve([{ id: "org-1" }])),
    $transaction: async (fn: (tx: typeof txClient) => Promise<unknown>) => {
      const run = () => fn(txClient);
      const next = txChain.then(run, run);
      txChain = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },
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

describe("EODWebhookHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    directorKyc = {
      directors: [
        {
          eodRequestId: "EOD001",
          name: "Ada",
          email: "ada@example.com",
          role: "DIRECTOR",
          kycStatus: "PENDING",
          lastUpdated: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    txChain = Promise.resolve();
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
    expect(mockWriteOnboardingAuditLog).not.toHaveBeenCalled();
    expect(mockFindInvestorOrganizationById).not.toHaveBeenCalled();
  });

  it("concurrent identical director KYC callbacks write one DIRECTOR_KYC_STATUS_UPDATED", async () => {
    mockRegTankOnboardingFindMany.mockResolvedValue([
      {
        id: "row-1",
        request_id: "COD001",
        status: "IN_PROGRESS",
        onboarding_type: "CORPORATE",
        organization_type: OrganizationType.COMPANY,
        investor_organization_id: "org-1",
        issuer_organization_id: null,
        portal_type: "investor",
        user_id: "user-1",
        webhook_payloads: [
          {
            corpIndvDirectors: ["EOD001"],
            corpIndvShareholders: [],
            corpBizShareholders: [],
          },
        ],
      },
    ]);
    const handler = new EODWebhookHandler();
    const payload = {
      requestId: "EOD001",
      status: "WAIT_FOR_APPROVAL",
      kycId: "KYC001",
    };

    await Promise.all([(handler as any).handle(payload), (handler as any).handle(payload)]);

    expect(directorKyc.directors[0]?.kycStatus).toBe("WAIT_FOR_APPROVAL");
    expect(mockWriteOnboardingAuditLog).toHaveBeenCalledTimes(1);
    expect(mockWriteOnboardingAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "DIRECTOR_KYC_STATUS_UPDATED" }),
      expect.anything()
    );
  });
});
