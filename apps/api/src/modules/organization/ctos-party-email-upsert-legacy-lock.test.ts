import { AppError } from "../../lib/http/error-handler";

const PARTY_KEY = "800101011234";
const USER_ID = "user-123";

const writeOrganizationPartyEmailMock = jest.fn();

jest.mock("../organization-profile/person-email", () => ({
  writeOrganizationPartyEmail: (...args: unknown[]) => writeOrganizationPartyEmailMock(...args),
}));

jest.mock("@cashsouk/types", () => {
  const actual = jest.requireActual("@cashsouk/types") as Record<string, unknown>;
  return {
    ...actual,
    // Make upsert path deterministic for the test:
    canManageDirectorShareholder: () => true,
    filterVisiblePeopleRows: (rows: unknown[]) => rows,
    getDirectorShareholderDisplayRows: () => [
      {
        type: "INDIVIDUAL",
        id: PARTY_KEY,
        idNumber: PARTY_KEY,
        enquiryId: PARTY_KEY,
      },
    ],
    isCtosIndividualKycEligibleRow: () => true,
    isLegacyCtosPartyKycApproved: () => true,
  };
});

import { OrganizationType, OnboardingStatus } from "@prisma/client";
import { OrganizationService } from "./service";

describe("upsertCtosPartyEmail legacy lock regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeOrganizationPartyEmailMock.mockReset();
  });

  it("does not return { success: true } early for legacy KYC-approved parties", async () => {
    writeOrganizationPartyEmailMock.mockRejectedValueOnce(
      new AppError(400, "KYC_ALREADY_APPROVED", "This person has already completed KYC. Email cannot be changed.")
    );

    const service = new OrganizationService();

    jest.spyOn(service, "getOrganization").mockResolvedValueOnce({
      type: OrganizationType.COMPANY,
      onboarding_status: OnboardingStatus.COMPLETED,
      owner_user_id: USER_ID,
      members: [],
    } as any);

    jest.spyOn(service, "getCorporateEntities").mockResolvedValueOnce({
      people: [{ matchKey: PARTY_KEY }],
      directorKycStatus: {},
      directorAmlStatus: {},
      latestOrganizationCtosCompanyJson: null,
      ctosPartySupplements: [],
    } as any);

    await expect(
      service.upsertCtosPartyEmail(USER_ID, "org-1", "issuer", { partyKey: PARTY_KEY, email: "new@acme.test" })
    ).rejects.toMatchObject({ statusCode: 400, code: "KYC_ALREADY_APPROVED" });

    expect(writeOrganizationPartyEmailMock).toHaveBeenCalledTimes(1);
  });
});

