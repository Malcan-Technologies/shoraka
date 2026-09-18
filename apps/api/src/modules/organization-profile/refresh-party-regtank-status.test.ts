import { OrganizationMemberRole, OrganizationType, OnboardingStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { REGTANK_RATE_LIMITED_CODE } from "../regtank/helpers/regtank-rate-limit";
import { resetOnboardingRefreshLockForTests } from "../regtank/helpers/regtank-refresh-lock";
import type { ApplicationPersonRow } from "@cashsouk/types";
import { mergeCtosPartySupplementDocument } from "@cashsouk/types";

const mockPartyFindFirst = jest.fn();
const mockSupplementFindFirst = jest.fn();
const mockSupplementUpdate = jest.fn();
const mockSupplementCreate = jest.fn();
const mockRegTankOnboardingFindFirst = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
    },
    ctosPartySupplement: {
      findFirst: (...args: unknown[]) => mockSupplementFindFirst(...args),
      update: (...args: unknown[]) => mockSupplementUpdate(...args),
      create: (...args: unknown[]) => mockSupplementCreate(...args),
    },
    regTankOnboarding: {
      findFirst: (...args: unknown[]) => mockRegTankOnboardingFindFirst(...args),
    },
  },
}));

jest.mock("../organization/service", () => ({
  OrganizationService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({})),
}));

import {
  PARTY_STATUS_REFRESH_FAILED_MESSAGE,
  PARTY_STATUS_REFRESH_RECENTLY_MESSAGE,
  PARTY_STATUS_REFRESHED_MESSAGE,
  refreshAdminPartyRegTankStatus,
  refreshPartyRegTankStatus,
} from "./refresh-party-regtank-status";

const individualPerson: ApplicationPersonRow = {
  matchKey: "user:jamie",
  name: "Jamie Lim",
  entityType: "INDIVIDUAL",
  roles: ["DIRECTOR"],
  sharePercentage: null,
  status: "",
  onboarding: { status: "WAIT_FOR_APPROVAL", id: "LD1001" },
  screening: { status: "PENDING", id: "KYC1001" },
  requestId: "LD1001",
  screeningRequestId: "KYC1001",
};

const corporatePerson: ApplicationPersonRow = {
  matchKey: "199501012345",
  name: "ABC Berhad",
  entityType: "CORPORATE",
  roles: ["SHAREHOLDER"],
  sharePercentage: 30,
  status: "",
  onboarding: { status: "IN_PROGRESS", id: "COD2001" },
  screening: { status: "PENDING", id: "KYB2001" },
  partyCorporateRequestId: "COD2001",
  screeningRequestId: "KYB2001",
};

function org() {
  return {
    type: OrganizationType.COMPANY,
    onboarding_status: OnboardingStatus.COMPLETED,
    owner_user_id: "owner-1",
    members: [{ user_id: "owner-1", role: OrganizationMemberRole.ORGANIZATION_ADMIN }],
  };
}

function laterAddedParty(overrides: Record<string, unknown> = {}) {
  return {
    id: "party-1",
    party_key: "user:jamie",
    origin: "USER_ADDED",
    membership_status: "MASTER_ACTIVE",
    identity_number: null,
    entity_type: "INDIVIDUAL",
    name: "Jamie Lim",
    is_director: true,
    is_shareholder: false,
    ...overrides,
  };
}

describe("refreshPartyRegTankStatus", () => {
  const queryOnboardingDetails = jest.fn();
  const getEntityOnboardingDetails = jest.fn();
  const getCorporateOnboardingDetails = jest.fn();
  const queryKYCStatus = jest.fn();
  const queryKYBStatus = jest.fn();
  const getOrganization = jest.fn();
  const getCorporateEntities = jest.fn();

  const deps = {
    organizationService: { getOrganization, getCorporateEntities },
    regTankClient: {
      queryOnboardingDetails,
      getEntityOnboardingDetails,
      getCorporateOnboardingDetails,
      queryKYCStatus,
      queryKYBStatus,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetOnboardingRefreshLockForTests();
    getOrganization.mockResolvedValue(org());
    mockPartyFindFirst.mockResolvedValue(laterAddedParty());
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: mergeCtosPartySupplementDocument(null, {
        onboarding: { requestId: "LD1001" },
        regtankPipelineStatus: "WAIT_FOR_APPROVAL",
        screening: { requestId: "KYC1001", status: "PENDING" },
      }),
    });
    mockSupplementUpdate.mockResolvedValue({});
    mockSupplementCreate.mockResolvedValue({});
    mockRegTankOnboardingFindFirst.mockResolvedValue(null);
    getCorporateEntities.mockResolvedValue({ people: [individualPerson] });
    queryOnboardingDetails.mockResolvedValue({ status: "IN_PROGRESS" });
    queryKYCStatus.mockResolvedValue({ status: "PENDING" });
  });

  it("refresh individual → correct request queried", async () => {
    const result = await refreshPartyRegTankStatus("owner-1", "issuer", "org-1", "party-1", deps);
    expect(result.message).toBe(PARTY_STATUS_REFRESHED_MESSAGE);
    expect(queryOnboardingDetails).toHaveBeenCalledWith("LD1001");
    expect(queryKYCStatus).toHaveBeenCalledWith("KYC1001");
    expect(getCorporateOnboardingDetails).not.toHaveBeenCalled();
    expect(getEntityOnboardingDetails).not.toHaveBeenCalled();
    expect(queryKYBStatus).not.toHaveBeenCalled();
    expect(mockSupplementUpdate).toHaveBeenCalled();
  });

  it("refresh corporate → correct request queried", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({ id: "party-corp", party_key: "199501012345" })
    );
    getCorporateEntities.mockResolvedValue({ people: [corporatePerson] });
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-corp",
      onboarding_json: mergeCtosPartySupplementDocument(null, {
        onboarding: { requestId: "COD2001" },
        regtankPipelineStatus: "IN_PROGRESS",
        screening: { requestId: "KYB2001", status: "PENDING" },
      }),
    });
    getCorporateOnboardingDetails.mockResolvedValue({ status: "WAIT_FOR_APPROVAL" });
    queryKYBStatus.mockResolvedValue({ status: "PENDING" });

    await refreshPartyRegTankStatus("owner-1", "issuer", "org-1", "party-corp", deps);

    expect(getCorporateOnboardingDetails).toHaveBeenCalledWith("COD2001");
    expect(queryKYBStatus).toHaveBeenCalledWith("KYB2001");
    expect(queryOnboardingDetails).not.toHaveBeenCalled();
    expect(queryKYCStatus).not.toHaveBeenCalled();
  });

  it("double click → one provider operation", async () => {
    let release: ((value: unknown) => void) | undefined;
    queryOnboardingDetails.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );

    const first = refreshPartyRegTankStatus("owner-1", "issuer", "org-1", "party-1", deps);
    for (let i = 0; i < 40 && queryOnboardingDetails.mock.calls.length === 0; i += 1) {
      await Promise.resolve();
    }
    expect(queryOnboardingDetails).toHaveBeenCalledTimes(1);

    const second = refreshPartyRegTankStatus("owner-1", "issuer", "org-1", "party-1", deps);
    await expect(second).rejects.toMatchObject({
      statusCode: 429,
      code: REGTANK_RATE_LIMITED_CODE,
      message: PARTY_STATUS_REFRESH_RECENTLY_MESSAGE,
    });
    release?.({ status: "IN_PROGRESS" });
    await first;
    expect(queryOnboardingDetails).toHaveBeenCalledTimes(1);
    expect(queryKYCStatus).toHaveBeenCalledTimes(1);
  });

  it("provider failure → last known status preserved", async () => {
    queryOnboardingDetails.mockRejectedValue(new Error("socket hang up"));
    queryKYCStatus.mockRejectedValue(new Error("socket hang up"));

    await expect(
      refreshPartyRegTankStatus("owner-1", "issuer", "org-1", "party-1", deps)
    ).rejects.toMatchObject({
      statusCode: 502,
      message: PARTY_STATUS_REFRESH_FAILED_MESSAGE,
    });
    expect(mockSupplementUpdate).not.toHaveBeenCalled();
    expect(mockSupplementCreate).not.toHaveBeenCalled();
  });

  it("rate limit → friendly message", async () => {
    queryOnboardingDetails.mockRejectedValue(
      new AppError(429, REGTANK_RATE_LIMITED_CODE, "RegTank is temporarily limiting status requests.")
    );

    await expect(
      refreshPartyRegTankStatus("owner-1", "issuer", "org-1", "party-1", deps)
    ).rejects.toMatchObject({
      statusCode: 429,
      message: PARTY_STATUS_REFRESH_RECENTLY_MESSAGE,
    });
    expect(mockSupplementUpdate).not.toHaveBeenCalled();
  });

  it("does not query the parent organisation COD", async () => {
    getCorporateEntities.mockResolvedValue({
      people: [
        {
          ...individualPerson,
          parentCorporateRequestId: "COD-PARENT",
        },
      ],
    });
    await refreshPartyRegTankStatus("owner-1", "issuer", "org-1", "party-1", deps);
    expect(getCorporateOnboardingDetails).not.toHaveBeenCalled();
  });

  it("does not refresh initial CTOS parties", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({ origin: "CTOS_PARTY", party_key: "900101145678" })
    );
    await expect(
      refreshPartyRegTankStatus("owner-1", "issuer", "org-1", "party-1", deps)
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect(queryOnboardingDetails).not.toHaveBeenCalled();
  });
});

describe("refreshAdminPartyRegTankStatus", () => {
  const queryOnboardingDetails = jest.fn();
  const getEntityOnboardingDetails = jest.fn();
  const getCorporateOnboardingDetails = jest.fn();
  const queryKYCStatus = jest.fn();
  const queryKYBStatus = jest.fn();
  const regTankClient = {
    queryOnboardingDetails,
    getEntityOnboardingDetails,
    getCorporateOnboardingDetails,
    queryKYCStatus,
    queryKYBStatus,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetOnboardingRefreshLockForTests();
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({
        party_key: "891114075601",
        origin: "CTOS_PARTY",
        identity_number: "891114075601",
      })
    );
    mockSupplementFindFirst.mockResolvedValue(null);
    mockSupplementUpdate.mockResolvedValue({});
    mockSupplementCreate.mockResolvedValue({});
    mockRegTankOnboardingFindFirst.mockResolvedValue({ request_id: "COD-PARENT" });
    getCorporateOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "COD-PARENT") {
        return {
          corpIndvDirectors: [
            {
              corporateIndividualRequest: { requestId: "EOD06938" },
              corporateUserRequestInfo: {
                fullName: "Ivan Chew Ken Yoong",
                formContent: {
                  content: [
                    { fieldName: "First Name", fieldValue: "Ivan Chew" },
                    { fieldName: "Last Name", fieldValue: "Ken Yoong" },
                    { fieldName: "Government ID Number", fieldValue: "891114075601" },
                  ],
                },
              },
            },
          ],
          corpIndvShareholders: [],
          corpBizShareholders: [],
        };
      }
      return { status: "APPROVED" };
    });
    getEntityOnboardingDetails.mockResolvedValue({
      status: "APPROVED",
      kycRequestInfo: { kycId: "KYC00189" },
    });
    queryKYCStatus.mockResolvedValue({
      status: "APPROVED",
      messageStatus: "DONE",
      individualRiskScore: { level: "LOW", score: 1 },
    });
  });

  it("discovers and persists an original CTOS person's current KYC and AML status", async () => {
    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(getCorporateOnboardingDetails).toHaveBeenCalledWith("COD-PARENT");
    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD06938");
    expect(queryKYCStatus).toHaveBeenCalledWith("KYC00189");
    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING", "KYC"]);
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          party_key: "891114075601",
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

  it("re-discovers current IDs from the parent COD for an original CTOS party", async () => {
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: mergeCtosPartySupplementDocument(null, {
        onboarding: { requestId: "EOD-STALE", status: "APPROVED" },
        screening: { requestId: "KYC-STALE", status: "APPROVED" },
      }),
    });
    queryKYCStatus.mockResolvedValue({ status: "REJECTED", messageStatus: "DONE" });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(getCorporateOnboardingDetails).toHaveBeenCalledWith("COD-PARENT");
    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD06938");
    expect(getEntityOnboardingDetails).not.toHaveBeenCalledWith("EOD-STALE");
    expect(queryKYCStatus).toHaveBeenCalledWith("KYC00189");
    expect(queryKYCStatus).not.toHaveBeenCalledWith("KYC-STALE");
    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING", "KYC"]);
    expect(mockSupplementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "EOD06938",
            screening: expect.objectContaining({ status: "REJECTED" }),
          }),
        }),
      })
    );
  });

  it("clears stale screening when the current child EOD confirms AML has not started", async () => {
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: mergeCtosPartySupplementDocument(null, {
        onboarding: { requestId: "EOD-STALE", status: "APPROVED" },
        screening: { requestId: "KYC-STALE", status: "APPROVED" },
      }),
    });
    getEntityOnboardingDetails.mockResolvedValue({ status: "IN_PROGRESS" });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD06938");
    expect(getEntityOnboardingDetails).not.toHaveBeenCalledWith("EOD-STALE");
    expect(queryKYCStatus).not.toHaveBeenCalled();
    expect(queryKYCStatus).not.toHaveBeenCalledWith("KYC-STALE");
    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING"]);
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

  it("clears stale AML when parent still embeds old KYC and the current child has none", async () => {
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: mergeCtosPartySupplementDocument(null, {
        onboarding: { requestId: "EOD-STALE", status: "APPROVED" },
        screening: { requestId: "KYC-PARENT-OLD", status: "APPROVED" },
      }),
    });
    getCorporateOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "COD-PARENT") {
        return {
          corpIndvDirectors: [
            {
              corporateIndividualRequest: { requestId: "EOD06938" },
              kycRequestInfo: { kycId: "KYC-PARENT-OLD" },
              corporateUserRequestInfo: {
                fullName: "Ivan Chew Ken Yoong",
                formContent: {
                  content: [
                    { fieldName: "First Name", fieldValue: "Ivan Chew" },
                    { fieldName: "Last Name", fieldValue: "Ken Yoong" },
                    { fieldName: "Government ID Number", fieldValue: "891114075601" },
                  ],
                },
              },
            },
          ],
          corpIndvShareholders: [],
          corpBizShareholders: [],
        };
      }
      return { status: "APPROVED" };
    });
    getEntityOnboardingDetails.mockResolvedValue({ status: "IN_PROGRESS" });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD06938");
    expect(queryKYCStatus).not.toHaveBeenCalled();
    expect(queryKYCStatus).not.toHaveBeenCalledWith("KYC-PARENT-OLD");
    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING"]);
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

  it("fails without writing when the current child response has no recognizable status", async () => {
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: mergeCtosPartySupplementDocument(null, {
        onboarding: { requestId: "EOD06938", status: "APPROVED" },
        screening: { requestId: "KYC00189", status: "APPROVED" },
      }),
    });
    getEntityOnboardingDetails.mockResolvedValue({ message: "accepted" });

    await expect(
      refreshAdminPartyRegTankStatus("issuer", "org-1", "party-1", {
        regTankClient,
      })
    ).rejects.toMatchObject({ code: "PROVIDER_REFRESH_FAILED" });
    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD06938");
    expect(queryKYCStatus).not.toHaveBeenCalled();
    expect(mockSupplementCreate).not.toHaveBeenCalled();
    expect(mockSupplementUpdate).not.toHaveBeenCalled();
  });

  it("uses the child EOD screening ID when the parent COD still embeds a stale KYC", async () => {
    getCorporateOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "COD-PARENT") {
        return {
          corpIndvDirectors: [
            {
              corporateIndividualRequest: { requestId: "EOD06938" },
              kycRequestInfo: { kycId: "KYC-PARENT-OLD" },
              corporateUserRequestInfo: {
                fullName: "Ivan Chew Ken Yoong",
                formContent: {
                  content: [
                    { fieldName: "First Name", fieldValue: "Ivan Chew" },
                    { fieldName: "Last Name", fieldValue: "Ken Yoong" },
                    { fieldName: "Government ID Number", fieldValue: "891114075601" },
                  ],
                },
              },
            },
          ],
          corpIndvShareholders: [],
          corpBizShareholders: [],
        };
      }
      return { status: "APPROVED" };
    });
    getEntityOnboardingDetails.mockResolvedValue({
      status: "APPROVED",
      kycRequestInfo: { kycId: "KYC00189" },
    });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD06938");
    expect(queryKYCStatus).toHaveBeenCalledWith("KYC00189");
    expect(queryKYCStatus).not.toHaveBeenCalledWith("KYC-PARENT-OLD");
    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING", "KYC"]);
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "EOD06938",
            screening: expect.objectContaining({ requestId: "KYC00189" }),
          }),
        }),
      })
    );
  });

  it("uses complete stored IDs for a later-added person without querying the parent COD", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({
        party_key: "user:jamie",
        origin: "USER_ADDED",
        identity_number: null,
      })
    );
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-later",
      onboarding_json: mergeCtosPartySupplementDocument(null, {
        onboarding: { requestId: "LD1001", status: "WAIT_FOR_APPROVAL" },
        screening: { requestId: "KYC1001", status: "PENDING" },
      }),
    });
    queryOnboardingDetails.mockResolvedValue({ status: "IN_PROGRESS" });
    queryKYCStatus.mockResolvedValue({ status: "PENDING" });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(mockRegTankOnboardingFindFirst).not.toHaveBeenCalled();
    expect(getCorporateOnboardingDetails).not.toHaveBeenCalled();
    expect(queryOnboardingDetails).toHaveBeenCalledWith("LD1001");
    expect(queryKYCStatus).toHaveBeenCalledWith("KYC1001");
    expect(result.refreshedSources).toEqual(["INDIVIDUAL_ONBOARDING", "KYC"]);
  });

  it("matches an original corporate shareholder by unique parent-COD name", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({
        party_key: "199501012345",
        origin: "CTOS_PARTY",
        identity_number: null,
        entity_type: "CORPORATE",
        name: "ABC Berhad",
        is_director: false,
        is_shareholder: true,
      })
    );
    getCorporateOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "COD-PARENT") {
        return {
          corpIndvDirectors: [],
          corpIndvShareholders: [],
          corpBizShareholders: [
            {
              name: "ABC Berhad",
              corporateOnboardingRequest: { requestId: "COD05080" },
              formContent: {
                content: [{ fieldName: "% of Shares", fieldValue: "30" }],
              },
            },
          ],
        };
      }
      return {
        status: "WAIT_FOR_APPROVAL",
        kybRequestDto: { kybId: "KYB2001" },
      };
    });
    queryKYBStatus.mockResolvedValue({
      status: "PENDING",
      corporateRiskScore: { level: "MEDIUM", score: 2.5 },
    });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(getCorporateOnboardingDetails).toHaveBeenCalledWith("COD-PARENT");
    expect(getCorporateOnboardingDetails).toHaveBeenCalledWith("COD05080");
    expect(queryKYBStatus).toHaveBeenCalledWith("KYB2001");
    expect(result.refreshedSources).toEqual(["CORPORATE_ONBOARDING", "KYB"]);
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "COD05080",
            screening: expect.objectContaining({
              requestId: "KYB2001",
              riskLevel: "MEDIUM",
              riskScore: 2.5,
            }),
          }),
        }),
      })
    );
  });

  it("coalesces director and shareholder rows that share one identity", async () => {
    getCorporateOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "COD-PARENT") {
        const person = {
          corporateUserRequestInfo: {
            fullName: "Ivan Chew Ken Yoong",
            formContent: {
              content: [
                { fieldName: "First Name", fieldValue: "Ivan Chew" },
                { fieldName: "Last Name", fieldValue: "Ken Yoong" },
                { fieldName: "Government ID Number", fieldValue: "891114075601" },
              ],
            },
          },
        };
        return {
          corpIndvDirectors: [
            { ...person, corporateIndividualRequest: { requestId: "EOD06938" } },
          ],
          corpIndvShareholders: [
            {
              ...person,
              corporateIndividualRequest: { requestId: "EOD06938" },
              kycRequestInfo: { kycId: "KYC00189" },
            },
          ],
          corpBizShareholders: [],
        };
      }
      return { status: "APPROVED" };
    });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING", "KYC"]);
    expect(queryKYCStatus).toHaveBeenCalledWith("KYC00189");
    expect(mockSupplementCreate).toHaveBeenCalled();
  });

  it("refuses an ambiguous name-only match without writing", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({
        party_key: "user:alex",
        origin: "USER_ADDED",
        identity_number: null,
        name: "Alex Tan",
      })
    );
    getCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD1" },
          corporateUserRequestInfo: {
            fullName: "Alex Tan",
            formContent: {
              content: [{ fieldName: "Government ID Number", fieldValue: "800101011111" }],
            },
          },
        },
        {
          corporateIndividualRequest: { requestId: "EOD2" },
          corporateUserRequestInfo: {
            fullName: "Alex Tan",
            formContent: {
              content: [{ fieldName: "Government ID Number", fieldValue: "900101011111" }],
            },
          },
        },
      ],
    });

    await expect(
      refreshAdminPartyRegTankStatus("issuer", "org-1", "party-1", {
        regTankClient,
      })
    ).rejects.toMatchObject({ code: "AMBIGUOUS_REGTANK_PARTY" });
    expect(queryKYCStatus).not.toHaveBeenCalled();
    expect(mockSupplementCreate).not.toHaveBeenCalled();
  });

  it("refuses a name match when only one of the records has an identity", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({
        party_key: "user:alex",
        origin: "USER_ADDED",
        identity_number: null,
        name: "Alex Tan",
      })
    );
    getCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD1" },
          kycRequestInfo: { kycId: "KYC1" },
          corporateUserRequestInfo: {
            fullName: "Alex Tan",
            formContent: {
              content: [{ fieldName: "Government ID Number", fieldValue: "800101011111" }],
            },
          },
        },
        {
          corporateIndividualRequest: { requestId: "EOD2" },
          corporateUserRequestInfo: {
            fullName: "Alex Tan",
            formContent: { content: [] },
          },
        },
      ],
    });

    await expect(
      refreshAdminPartyRegTankStatus("issuer", "org-1", "party-1", {
        regTankClient,
      })
    ).rejects.toMatchObject({ code: "AMBIGUOUS_REGTANK_PARTY" });
    expect(getEntityOnboardingDetails).not.toHaveBeenCalled();
    expect(queryKYCStatus).not.toHaveBeenCalled();
    expect(mockSupplementCreate).not.toHaveBeenCalled();
    expect(mockSupplementUpdate).not.toHaveBeenCalled();
  });

  it("refuses same-name rows with conflicting identities even when they share a KYC ID", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({
        party_key: "user:alex",
        origin: "USER_ADDED",
        identity_number: null,
        name: "Alex Tan",
      })
    );
    getCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD1" },
          kycRequestInfo: { kycId: "KYC-SHARED" },
          corporateUserRequestInfo: {
            fullName: "Alex Tan",
            formContent: {
              content: [{ fieldName: "Government ID Number", fieldValue: "800101011111" }],
            },
          },
        },
        {
          corporateIndividualRequest: { requestId: "EOD2" },
          kycRequestInfo: { kycId: "KYC-SHARED" },
          corporateUserRequestInfo: {
            fullName: "Alex Tan",
            formContent: {
              content: [{ fieldName: "Government ID Number", fieldValue: "900101011111" }],
            },
          },
        },
      ],
    });

    await expect(
      refreshAdminPartyRegTankStatus("issuer", "org-1", "party-1", {
        regTankClient,
      })
    ).rejects.toMatchObject({ code: "AMBIGUOUS_REGTANK_PARTY" });
    expect(getEntityOnboardingDetails).not.toHaveBeenCalled();
    expect(queryKYCStatus).not.toHaveBeenCalled();
    expect(mockSupplementCreate).not.toHaveBeenCalled();
    expect(mockSupplementUpdate).not.toHaveBeenCalled();
  });

  it("refuses a unique name match when the live identity conflicts with the master", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({
        party_key: "891114075601",
        origin: "CTOS_PARTY",
        identity_number: "891114075601",
        name: "Ivan Chew Ken Yoong",
      })
    );
    getCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD-OTHER" },
          kycRequestInfo: { kycId: "KYC-OTHER" },
          corporateUserRequestInfo: {
            fullName: "Ivan Chew Ken Yoong",
            formContent: {
              content: [
                { fieldName: "First Name", fieldValue: "Ivan Chew" },
                { fieldName: "Last Name", fieldValue: "Ken Yoong" },
                { fieldName: "Government ID Number", fieldValue: "900101011111" },
              ],
            },
          },
        },
      ],
      corpIndvShareholders: [],
      corpBizShareholders: [],
    });

    await expect(
      refreshAdminPartyRegTankStatus("issuer", "org-1", "party-1", {
        regTankClient,
      })
    ).rejects.toMatchObject({ code: "AMBIGUOUS_REGTANK_PARTY" });
    expect(getEntityOnboardingDetails).not.toHaveBeenCalled();
    expect(queryKYCStatus).not.toHaveBeenCalled();
    expect(mockSupplementCreate).not.toHaveBeenCalled();
    expect(mockSupplementUpdate).not.toHaveBeenCalled();
  });

  it("persists the preferred dual-role EOD status instead of the first request", async () => {
    getCorporateOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "COD-PARENT") {
        const person = {
          corporateUserRequestInfo: {
            fullName: "Ivan Chew Ken Yoong",
            formContent: {
              content: [
                { fieldName: "First Name", fieldValue: "Ivan Chew" },
                { fieldName: "Last Name", fieldValue: "Ken Yoong" },
                { fieldName: "Government ID Number", fieldValue: "891114075601" },
              ],
            },
          },
        };
        return {
          corpIndvDirectors: [
            { ...person, corporateIndividualRequest: { requestId: "EOD06938" } },
          ],
          corpIndvShareholders: [
            {
              ...person,
              corporateIndividualRequest: { requestId: "EOD06939" },
              kycRequestInfo: { kycId: "KYC00189" },
            },
          ],
          corpBizShareholders: [],
        };
      }
      return { status: "APPROVED" };
    });
    getEntityOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "EOD06938") return { status: "APPROVED" };
      if (requestId === "EOD06939") {
        return { status: "REJECTED", kycRequestInfo: { kycId: "KYC00189" } };
      }
      return { status: "APPROVED" };
    });
    queryKYCStatus.mockResolvedValue({
      status: "REJECTED",
      messageStatus: "DONE",
    });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD06938");
    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD06939");
    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING", "KYC"]);
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "EOD06939",
            status: "REJECTED",
            screening: expect.objectContaining({
              requestId: "KYC00189",
              status: "REJECTED",
            }),
          }),
        }),
      })
    );
  });

  it("persists the preferred dual-role KYC when director and shareholder have distinct IDs", async () => {
    getCorporateOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "COD-PARENT") {
        const person = {
          corporateUserRequestInfo: {
            fullName: "Ivan Chew Ken Yoong",
            formContent: {
              content: [
                { fieldName: "First Name", fieldValue: "Ivan Chew" },
                { fieldName: "Last Name", fieldValue: "Ken Yoong" },
                { fieldName: "Government ID Number", fieldValue: "891114075601" },
              ],
            },
          },
        };
        return {
          corpIndvDirectors: [
            {
              ...person,
              corporateIndividualRequest: { requestId: "EOD06938" },
              kycRequestInfo: { kycId: "KYC-DIR" },
            },
          ],
          corpIndvShareholders: [
            {
              ...person,
              corporateIndividualRequest: { requestId: "EOD06939" },
              kycRequestInfo: { kycId: "KYC-SH" },
            },
          ],
          corpBizShareholders: [],
        };
      }
      return { status: "APPROVED" };
    });
    getEntityOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "EOD06938") {
        return { status: "APPROVED", kycRequestInfo: { kycId: "KYC-DIR" } };
      }
      if (requestId === "EOD06939") {
        return { status: "APPROVED", kycRequestInfo: { kycId: "KYC-SH" } };
      }
      return { status: "APPROVED" };
    });
    queryKYCStatus.mockImplementation(async (kycId: string) => {
      if (kycId === "KYC-DIR") return { status: "APPROVED", messageStatus: "DONE" };
      if (kycId === "KYC-SH") return { status: "REJECTED", messageStatus: "DONE" };
      return { status: "PENDING" };
    });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(queryKYCStatus).toHaveBeenCalledWith("KYC-DIR");
    expect(queryKYCStatus).toHaveBeenCalledWith("KYC-SH");
    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING", "KYC"]);
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "EOD06938",
            status: "APPROVED",
            screening: expect.objectContaining({
              requestId: "KYC-SH",
              status: "REJECTED",
            }),
          }),
        }),
      })
    );
  });

  it("matches an identity-less party from parent-COD firstName and lastName", async () => {
    mockPartyFindFirst.mockResolvedValue(
      laterAddedParty({
        party_key: "user:alex",
        origin: "USER_ADDED",
        identity_number: null,
        name: "Alex Tan",
      })
    );
    mockSupplementFindFirst.mockResolvedValue(null);
    getCorporateOnboardingDetails.mockImplementation(async (requestId: string) => {
      if (requestId === "COD-PARENT") {
        return {
          corpIndvDirectors: [
            {
              corporateIndividualRequest: { requestId: "EOD-ALEX" },
              corporateUserRequestInfo: {
                firstName: "Alex",
                lastName: "Tan",
                formContent: { content: [] },
              },
            },
          ],
          corpIndvShareholders: [],
          corpBizShareholders: [],
        };
      }
      return { status: "APPROVED" };
    });
    getEntityOnboardingDetails.mockResolvedValue({
      status: "APPROVED",
      kycRequestInfo: { kycId: "KYC-ALEX" },
    });
    queryKYCStatus.mockResolvedValue({ status: "APPROVED", messageStatus: "DONE" });

    const result = await refreshAdminPartyRegTankStatus(
      "issuer",
      "org-1",
      "party-1",
      { regTankClient }
    );

    expect(getEntityOnboardingDetails).toHaveBeenCalledWith("EOD-ALEX");
    expect(queryKYCStatus).toHaveBeenCalledWith("KYC-ALEX");
    expect(result.refreshedSources).toEqual(["ENTITY_ONBOARDING", "KYC"]);
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "EOD-ALEX",
            screening: expect.objectContaining({ requestId: "KYC-ALEX" }),
          }),
        }),
      })
    );
  });

  it("fails instead of reporting success when the refreshed snapshot cannot be saved", async () => {
    mockSupplementCreate.mockRejectedValue(new Error("database unavailable"));

    await expect(
      refreshAdminPartyRegTankStatus("issuer", "org-1", "party-1", {
        regTankClient,
      })
    ).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
  });

  it("does not persist a partial admin refresh when RegTank screening fails", async () => {
    queryKYCStatus.mockRejectedValue(new Error("screening unavailable"));

    await expect(
      refreshAdminPartyRegTankStatus("issuer", "org-1", "party-1", {
        regTankClient,
      })
    ).rejects.toMatchObject({ code: "PROVIDER_REFRESH_FAILED" });
    expect(mockSupplementCreate).not.toHaveBeenCalled();
    expect(mockSupplementUpdate).not.toHaveBeenCalled();
  });
});
