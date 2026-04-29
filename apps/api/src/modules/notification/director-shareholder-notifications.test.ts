import { NotificationTypeIds } from "./registry";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    notification: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    issuerOrganization: {
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

const getIssuerPartyListExtras = jest.fn();

jest.mock("../organization/service", () => ({
  OrganizationService: jest.fn().mockImplementation(() => ({
    getIssuerPartyListExtras,
  })),
}));

import { prisma } from "../../lib/prisma";
import {
  notifyIssuerDirectorShareholderRejected,
  runIssuerDirectorShareholderNotificationResolutionFromDb,
  runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert,
} from "./director-shareholder-notifications";

const CTOS_ONE_DIRECTOR = {
  directors: [
    {
      party_type: "I",
      position: "Director",
      nic_brno: "901234567890",
      name: "Test Director",
      equity_percentage: null,
    },
  ],
  shareholders: [],
};

/** One director on file — AML can be cleared via supplement. */
const CTOS_DIRECTOR_A_ONLY = {
  directors: [
    {
      party_type: "I",
      position: "Director",
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
      position: "Director",
      nic_brno: "901234567890",
      name: "Director A",
      equity_percentage: null,
    },
    {
      party_type: "I",
      position: "Director",
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

  it("sends mismatch only once for the same CTOS report id (idempotency key)", async () => {
    (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.notification.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-by-key" });
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

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
      NotificationTypeIds.DIRECTOR_SHAREHOLDER_MISMATCH,
      { issuerOrganizationId: "org-1" },
      "ds_mismatch:org-1:rep-same"
    );
  });

  it("creates mismatch notification on pending transition after CTOS insert", async () => {
    (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

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
      NotificationTypeIds.DIRECTOR_SHAREHOLDER_MISMATCH,
      { issuerOrganizationId: "org-1" },
      "ds_mismatch:org-1:rep-new"
    );
  });

  it("resolves notifications when there are no visible director/shareholder rows (empty CTOS parties)", async () => {
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "user-1",
      corporate_entities: null,
      director_kyc_status: null,
      director_aml_status: null,
    });
    getIssuerPartyListExtras.mockResolvedValue({
      latestOrganizationCtosCompanyJson: null,
      ctosPartySupplements: [],
    });
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await runIssuerDirectorShareholderNotificationResolutionFromDb("org-1");

    expect(prisma.notification.updateMany).toHaveBeenCalledTimes(2);
  });

  it("resolves mismatch and all org rejected notifications when AML is fully clear", async () => {
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "user-1",
      corporate_entities: null,
      director_kyc_status: null,
      director_aml_status: null,
    });
    getIssuerPartyListExtras.mockResolvedValue({
      latestOrganizationCtosCompanyJson: CTOS_ONE_DIRECTOR,
      ctosPartySupplements: [
        {
          partyKey: "901234567890",
          onboardingJson: { screening: { status: "APPROVED" } },
        },
      ],
    });
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await runIssuerDirectorShareholderNotificationResolutionFromDb("org-1");

    expect(prisma.notification.updateMany).toHaveBeenCalledTimes(2);
    const mismatchCall = (prisma.notification.updateMany as jest.Mock).mock.calls.find(
      (c) => c[0].where.notification_type_id === NotificationTypeIds.DIRECTOR_SHAREHOLDER_MISMATCH
    );
    const rejectedCall = (prisma.notification.updateMany as jest.Mock).mock.calls.find(
      (c) => c[0].where.notification_type_id === NotificationTypeIds.DIRECTOR_SHAREHOLDER_REJECTED
    );
    expect(mismatchCall).toBeDefined();
    expect(rejectedCall).toBeDefined();
  });

  it("sendTyped is not called for rejected notify with invalid party key", async () => {
    await notifyIssuerDirectorShareholderRejected({
      issuerOrganizationId: "org-1",
      ownerUserId: "user-1",
      partyKeyRaw: "   ",
      personName: "X",
    });
    expect(sendTyped).not.toHaveBeenCalled();
  });

  it("sendTyped creates rejected notification for valid party", async () => {
    await notifyIssuerDirectorShareholderRejected({
      issuerOrganizationId: "org-1",
      ownerUserId: "user-1",
      partyKeyRaw: "901234567890",
      personName: "Jane",
    });
    expect(sendTyped).toHaveBeenCalledWith(
      "user-1",
      NotificationTypeIds.DIRECTOR_SHAREHOLDER_REJECTED,
      expect.objectContaining({
        issuerOrganizationId: "org-1",
        partyKey: "901234567890",
        personName: "Jane",
      })
    );
  });
});
