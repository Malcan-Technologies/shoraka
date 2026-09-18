const mockSupplementFindFirst = jest.fn();
const mockSupplementUpdate = jest.fn();
const mockSupplementCreate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    ctosPartySupplement: {
      findFirst: (...args: unknown[]) => mockSupplementFindFirst(...args),
      update: (...args: unknown[]) => mockSupplementUpdate(...args),
      create: (...args: unknown[]) => mockSupplementCreate(...args),
    },
  },
}));

import { extractRegTankScreeningPatch, syncCtosPartyRegTankStatus } from "./regtank-party-sync";

describe("extractRegTankScreeningPatch (RegTank /v3/kyc/query)", () => {
  it("maps nested individualRiskScore into flattened CTOS screening fields", () => {
    const body = {
      requestId: "KYC00196",
      messageStatus: "DONE",
      status: "Approved",
      individualRiskScore: {
        score: 1.0,
        level: "Low Risk",
        rescreeningFreqInMonth: 12.0,
        riskSettingId: 9408,
      },
    };

    const patch = extractRegTankScreeningPatch(body, "KYC00196");
    expect(patch).toEqual(
      expect.objectContaining({
        provider: "ACURIS",
        requestId: "KYC00196",
        // extractRegTankStatus keeps the raw status string; normalization happens in merge.
        status: "Approved",
        riskLevel: "Low Risk",
        riskScore: 1.0,
        messageStatus: "DONE",
      })
    );

    expect(patch).not.toHaveProperty("possibleMatchCount");
    expect(patch).not.toHaveProperty("blacklistedMatchCount");
  });

  it("maps nested corporateRiskScore for KYB query responses", () => {
    const patch = extractRegTankScreeningPatch(
      {
        requestId: "KYB2001",
        messageStatus: "DONE",
        status: "Approved",
        corporateRiskScore: { level: "MEDIUM", score: 2.5 },
      },
      "KYB2001"
    );

    expect(patch).toEqual(
      expect.objectContaining({
        requestId: "KYB2001",
        status: "Approved",
        riskLevel: "MEDIUM",
        riskScore: 2.5,
        messageStatus: "DONE",
      })
    );
  });

  it("keeps top-level risk fields when nested score objects are absent", () => {
    const patch = extractRegTankScreeningPatch(
      { status: "Pending", riskLevel: "LOW", riskScore: 1 },
      "KYC1001"
    );
    expect(patch).toEqual(
      expect.objectContaining({
        riskLevel: "LOW",
        riskScore: 1,
      })
    );
  });

  it("labels Dow Jones screening IDs as DOWJONES", () => {
    expect(extractRegTankScreeningPatch({ status: "Approved" }, "DJKYC08238")).toEqual(
      expect.objectContaining({
        requestId: "DJKYC08238",
        provider: "DOWJONES",
      })
    );
    expect(extractRegTankScreeningPatch({ status: "Pending" }, "DJKYB1001")).toEqual(
      expect.objectContaining({
        requestId: "DJKYB1001",
        provider: "DOWJONES",
      })
    );
  });
});

describe("syncCtosPartyRegTankStatus persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupplementFindFirst.mockResolvedValue(null);
    mockSupplementCreate.mockResolvedValue({});
    mockSupplementUpdate.mockResolvedValue({});
  });

  it("persists the selected onboarding request ID with pipeline status", async () => {
    const result = await syncCtosPartyRegTankStatus({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: "891114075601",
      individualOnboardingRequestId: null,
      entityOnboardingRequestId: "EOD06938",
      corporateOnboardingRequestId: null,
      kycId: "KYC00189",
      kybId: null,
      regTankClient: {
        getEntityOnboardingDetails: jest.fn().mockResolvedValue({ status: "APPROVED" }),
        queryKYCStatus: jest.fn().mockResolvedValue({
          status: "APPROVED",
          individualRiskScore: { level: "LOW", score: 1 },
        }),
      },
    });

    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING", "KYC"]);
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "EOD06938",
            status: "APPROVED",
            screening: expect.objectContaining({
              requestId: "KYC00189",
              status: "APPROVED",
            }),
          }),
        }),
      })
    );
  });

  it("does not overwrite an existing onboarding request ID on screening-only refresh", async () => {
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: {
        requestId: "EOD06938",
        status: "APPROVED",
        screening: { requestId: "KYC00189", status: "PENDING" },
      },
    });

    await syncCtosPartyRegTankStatus({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: "891114075601",
      individualOnboardingRequestId: null,
      entityOnboardingRequestId: null,
      corporateOnboardingRequestId: null,
      kycId: "KYC00189",
      kybId: null,
      regTankClient: {
        queryKYCStatus: jest.fn().mockResolvedValue({ status: "REJECTED" }),
      },
    });

    expect(mockSupplementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "EOD06938",
            screening: expect.objectContaining({
              requestId: "KYC00189",
              status: "REJECTED",
            }),
          }),
        }),
      })
    );
  });

  it("clears stored screening when live discovery confirms AML has not started", async () => {
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: {
        requestId: "EOD-STALE",
        status: "APPROVED",
        screening: { requestId: "KYC-STALE", status: "APPROVED" },
      },
    });

    await syncCtosPartyRegTankStatus({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: "891114075601",
      individualOnboardingRequestId: null,
      entityOnboardingRequestId: "EOD06938",
      corporateOnboardingRequestId: null,
      kycId: null,
      kybId: null,
      clearScreening: true,
      regTankClient: {
        getEntityOnboardingDetails: jest.fn().mockResolvedValue({ status: "IN_PROGRESS" }),
      },
    });

    expect(mockSupplementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "EOD06938",
            status: "IN_PROGRESS",
            screening: null,
          }),
        }),
      })
    );
  });

  it("persists KYB corporateRiskScore onto the screening snapshot", async () => {
    await syncCtosPartyRegTankStatus({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: "199501012345",
      individualOnboardingRequestId: null,
      entityOnboardingRequestId: null,
      corporateOnboardingRequestId: "COD05080",
      kycId: null,
      kybId: "KYB2001",
      regTankClient: {
        getCorporateOnboardingDetails: jest.fn().mockResolvedValue({ status: "IN_PROGRESS" }),
        queryKYBStatus: jest.fn().mockResolvedValue({
          status: "PENDING",
          corporateRiskScore: { level: "HIGH", score: 9 },
        }),
      },
    });

    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "COD05080",
            screening: expect.objectContaining({
              requestId: "KYB2001",
              riskLevel: "HIGH",
              riskScore: 9,
            }),
          }),
        }),
      })
    );
  });
});
