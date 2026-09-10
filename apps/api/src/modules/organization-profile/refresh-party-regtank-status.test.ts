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
