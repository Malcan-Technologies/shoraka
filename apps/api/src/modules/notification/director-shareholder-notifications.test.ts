import { NotificationTypeIds } from "./registry";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    notification: {
      findUnique: jest.fn(),
    },
  },
}));

const sendTyped = jest.fn().mockResolvedValue({ id: "n1" });

jest.mock("./service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped,
  })),
}));

import { prisma } from "../../lib/prisma";
import { runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert } from "./director-shareholder-notifications";

/** One director on file — AML can be cleared via supplement. */
const CTOS_DIRECTOR_A_ONLY = {
  directors: [
    {
      party_type: "I",
      position: "DO",
      nic_brno: "901234567890",
      name: "Director A",
      equity_percentage: null,
    },
  ],
  shareholders: [],
};

/** New director B appears — no supplement yet → AML pending. */
const CTOS_DIRECTORS_A_AND_B = {
  directors: [
    {
      party_type: "I",
      position: "DO",
      nic_brno: "901234567890",
      name: "Director A",
      equity_percentage: null,
    },
    {
      party_type: "I",
      position: "DO",
      nic_brno: "801234567890",
      name: "Director B",
      equity_percentage: null,
    },
  ],
  shareholders: [],
};

const SUPPLEMENT_A_APPROVED = [
  { partyKey: "901234567890", onboardingJson: { screening: { status: "APPROVED" } } },
];

describe("director-shareholder-notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends action-required only once for the same CTOS report id + party key", async () => {
    (prisma.notification.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-by-key" });

    const payload = {
      issuerOrganizationId: "org-1",
      ownerUserId: "user-1",
      beforeCompanyJson: CTOS_DIRECTOR_A_ONLY,
      afterCompanyJson: CTOS_DIRECTORS_A_AND_B,
      newCtosReportId: "rep-same",
      corporateEntities: null,
      directorKycStatus: null,
      directorAmlStatus: null,
      supplements: SUPPLEMENT_A_APPROVED,
    };

    await runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert(payload);
    await runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert(payload);

    expect(sendTyped).toHaveBeenCalledTimes(1);
    expect(sendTyped).toHaveBeenCalledWith(
      "user-1",
      NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
      {
        issuerOrganizationId: "org-1",
        partyKey: "801234567890",
        personName: "Director B",
        link: "/profile",
      },
      "ds_action_required:org-1:rep-same:801234567890"
    );
  });

  it("creates action-required notification on CTOS new person transition", async () => {
    (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

    await runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert({
      issuerOrganizationId: "org-1",
      ownerUserId: "user-1",
      beforeCompanyJson: CTOS_DIRECTOR_A_ONLY,
      afterCompanyJson: CTOS_DIRECTORS_A_AND_B,
      newCtosReportId: "rep-new",
      corporateEntities: null,
      directorKycStatus: null,
      directorAmlStatus: null,
      supplements: SUPPLEMENT_A_APPROVED,
    });

    expect(sendTyped).toHaveBeenCalledTimes(1);
    expect(sendTyped).toHaveBeenCalledWith(
      "user-1",
      NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
      {
        issuerOrganizationId: "org-1",
        partyKey: "801234567890",
        personName: "Director B",
        link: "/profile",
      },
      "ds_action_required:org-1:rep-new:801234567890"
    );
  });
});
