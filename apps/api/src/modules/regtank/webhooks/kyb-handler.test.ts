import { OrganizationType } from "@prisma/client";

const mockFindByRequestId = jest.fn();
const mockFindByReferenceId = jest.fn().mockResolvedValue(null);
const mockAppendWebhookPayload = jest.fn().mockResolvedValue(undefined);
const mockUpdateStatus = jest.fn().mockResolvedValue({});

jest.mock("../repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findByRequestId: (...args: unknown[]) => mockFindByRequestId(...args),
    findByReferenceId: (...args: unknown[]) => mockFindByReferenceId(...args),
    appendWebhookPayload: (...args: unknown[]) => mockAppendWebhookPayload(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  })),
}));

const mockFindInvestorOrganizationById = jest.fn().mockResolvedValue({ id: "org-1", name: "Test Org" });
jest.mock("../../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: jest.fn(),
  })),
}));

const mockUpsertMapping = jest.fn().mockResolvedValue({});
jest.mock("../aml-identity-repository", () => ({
  AmlIdentityRepository: jest.fn().mockImplementation(() => ({
    upsertMapping: (...args: unknown[]) => mockUpsertMapping(...args),
  })),
}));

const mockGetCorporateOnboardingDetails = jest.fn();
jest.mock("../api-client", () => ({
  getRegTankAPIClient: () => ({
    getCorporateOnboardingDetails: (...args: unknown[]) => mockGetCorporateOnboardingDetails(...args),
  }),
}));

const mockMaybeAdvance = jest.fn().mockResolvedValue({});
jest.mock("./org-aml-milestone", () => ({
  maybeAdvanceOrgAfterAmlScreeningCleared: (...args: unknown[]) => mockMaybeAdvance(...args),
}));

jest.mock("../../admin/guarantor-aml-webhook-sync", () => ({
  syncApplicationGuarantorsFromRegTankAmlWebhook: jest.fn().mockResolvedValue(0),
}));

const mockSyncCorporateShareholderStatus = jest.fn().mockResolvedValue(true);
jest.mock("../helpers/corporate-shareholder-status-sync", () => {
  const actual = jest.requireActual("../helpers/corporate-shareholder-status-sync") as typeof import("../helpers/corporate-shareholder-status-sync");
  return {
    ...actual,
    syncCorporateShareholderStatusInOrganization: (...args: unknown[]) =>
      mockSyncCorporateShareholderStatus(...args),
  };
});

const mockInvestorFindMany = jest.fn().mockResolvedValue([]);
const mockIssuerFindMany = jest.fn().mockResolvedValue([]);
const mockInvestorUpdate = jest.fn().mockResolvedValue({});
const mockIssuerUpdate = jest.fn().mockResolvedValue({});

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    investorOrganization: {
      update: (...args: unknown[]) => mockInvestorUpdate(...args),
      findMany: (...args: unknown[]) => mockInvestorFindMany(...args),
    },
    issuerOrganization: {
      update: (...args: unknown[]) => mockIssuerUpdate(...args),
      findMany: (...args: unknown[]) => mockIssuerFindMany(...args),
    },
  },
}));

import { KYBWebhookHandler } from "./kyb-handler";

function baseCodOnboardingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    request_id: "COD001",
    status: "PENDING_APPROVAL",
    onboarding_type: "CORPORATE",
    organization_type: OrganizationType.COMPANY,
    investor_organization_id: "org-1",
    issuer_organization_id: null,
    portal_type: "investor",
    user_id: "user-1",
    ...overrides,
  };
}

function apexOrg() {
  return {
    id: "org-quantum",
    corporate_entities: {
      corporateShareholders: [
        {
          requestId: "COD05579",
          companyName: "ApexStar Holdings Sdn. Bhd.",
          status: "APPROVED",
          formContent: {
            displayAreas: [
              {
                displayArea: "Basic Information Setting",
                content: [
                  { fieldName: "Business Name", fieldValue: "ApexStar Holdings Sdn. Bhd." },
                  { fieldName: "% of Shares", fieldValue: "10" },
                  { fieldName: "Business Number", fieldValue: "7321984G" },
                ],
              },
            ],
          },
        },
      ],
    },
    director_aml_status: {
      directors: [
        {
          name: "Nur Aina Farisha Binti Salleh",
          role: "Shareholder (6%)",
          kycId: "KYC00182",
          amlStatus: "Approved",
        },
      ],
      businessShareholders: [
        {
          kybId: "KYB00109",
          amlStatus: "Pending",
          rawStatus: null,
          businessName: "ApexStar Holdings Sdn. Bhd.",
          codRequestId: "COD05579",
          sharePercentage: 10,
          amlMessageStatus: "PENDING",
        },
      ],
    },
  };
}

describe("KYBWebhookHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvestorFindMany.mockResolvedValue([]);
    mockIssuerFindMany.mockResolvedValue([]);
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      formContent: {
        displayAreas: [
          {
            displayArea: "Basic Information Setting",
            content: [
              { fieldName: "Business Name", fieldValue: "ApexStar Holdings Sdn. Bhd." },
              { fieldName: "% of Shares", fieldValue: "10" },
              { fieldName: "Business Number", fieldValue: "7321984G" },
            ],
          },
        ],
      },
    });
  });

  it("B3: KYB Approved does not overwrite the COD onboarding lifecycle status", async () => {
    mockFindByRequestId.mockResolvedValue(baseCodOnboardingRow());
    const handler = new KYBWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYB001",
      onboardingId: "COD001",
      status: "Approved",
    });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockMaybeAdvance).toHaveBeenCalledTimes(1);
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
  });

  it("B4: KYB unknown status is preserved but does not alter onboarding lifecycle status", async () => {
    mockFindByRequestId.mockResolvedValue(baseCodOnboardingRow());
    const handler = new KYBWebhookHandler("ACURIS");

    await (handler as any).handle({
      requestId: "KYB001",
      onboardingId: "COD001",
      status: "Some Undocumented KYB Status",
    });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockMaybeAdvance).not.toHaveBeenCalled();
  });

  it("writes nested shareholder KYB onto director_aml_status.businessShareholders when onboardingId is the parent COD", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseCodOnboardingRow({
        request_id: "COD05578",
        investor_organization_id: "org-quantum",
      })
    );
    mockFindInvestorOrganizationById.mockResolvedValue({
      id: "org-quantum",
      name: "QuantumEdge Solutions Sdn. Bhd.",
    });
    mockInvestorFindMany.mockResolvedValue([apexOrg()]);

    const handler = new KYBWebhookHandler("ACURIS");
    await (handler as any).handle({
      requestId: "KYB00109",
      onboardingId: "COD05578",
      status: "Approved",
      messageStatus: "DONE",
    });

    expect(mockMaybeAdvance).toHaveBeenCalledTimes(1);
    expect(mockGetCorporateOnboardingDetails).toHaveBeenCalledWith("COD05579");
    expect(mockGetCorporateOnboardingDetails).not.toHaveBeenCalledWith("COD05578");

    expect(mockInvestorUpdate).toHaveBeenCalled();
    const updateArg = mockInvestorUpdate.mock.calls[0][0] as {
      data: { director_aml_status: Record<string, unknown> };
    };
    const aml = updateArg.data.director_aml_status as {
      directors: Array<{ kycId?: string }>;
      businessShareholders: Array<{
        kybId?: string;
        codRequestId?: string;
        amlStatus?: string;
        businessName?: string;
        rawStatus?: string;
        businessNumber?: string;
      }>;
    };
    expect(aml.directors).toHaveLength(1);
    expect(aml.directors[0].kycId).toBe("KYC00182");
    expect(aml.businessShareholders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kybId: "KYB00109",
          codRequestId: "COD05579",
          amlStatus: "Approved",
          rawStatus: "Approved",
          businessName: "ApexStar Holdings Sdn. Bhd.",
          businessNumber: "7321984G",
        }),
      ])
    );

    expect(mockUpsertMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "business_shareholder",
        kyb_id: "KYB00109",
        cod_request_id: "COD05579",
        business_name: "ApexStar Holdings Sdn. Bhd.",
      })
    );
    expect(mockSyncCorporateShareholderStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        incomingCodRequestId: "COD05579",
        newStatus: "Approved",
        source: "KYB",
      })
    );
  });

  it("does not copy main-company KYB onto a nested shareholder with a different kybId", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseCodOnboardingRow({
        request_id: "COD05578",
        investor_organization_id: "org-quantum",
      })
    );
    mockInvestorFindMany.mockResolvedValue([apexOrg()]);

    const handler = new KYBWebhookHandler("ACURIS");
    await (handler as any).handle({
      requestId: "KYB-MAIN",
      onboardingId: "COD05578",
      status: "Approved",
      messageStatus: "DONE",
    });

    expect(mockMaybeAdvance).toHaveBeenCalledTimes(1);
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
    expect(mockUpsertMapping).not.toHaveBeenCalled();
  });
});
