import { NotificationTypeIds } from "./registry";
import { initialNotificationTypes } from "./seed-data";
import { NotificationPortalTarget } from "@prisma/client";

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
import {
  runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert,
  runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert,
  shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert,
} from "./director-shareholder-notifications";

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

const CTOS_EMPTY = {
  directors: [],
  shareholders: [],
};

const SUPPLEMENT_A_APPROVED = [
  { partyKey: "901234567890", onboardingJson: { screening: { status: "APPROVED" } } },
];

const baseIssuerPayload = {
  issuerOrganizationId: "org-1",
  ownerUserId: "user-1",
  beforeCompanyJson: CTOS_DIRECTOR_A_ONLY,
  afterCompanyJson: CTOS_DIRECTORS_A_AND_B,
  newCtosReportId: "rep-new",
  corporateEntities: null,
  directorKycStatus: null,
  directorAmlStatus: null,
  supplements: SUPPLEMENT_A_APPROVED,
};

const baseInvestorPayload = {
  investorOrganizationId: "inv-org-1",
  ownerUserId: "inv-user-1",
  beforeCompanyJson: CTOS_DIRECTOR_A_ONLY,
  afterCompanyJson: CTOS_DIRECTORS_A_AND_B,
  newCtosReportId: "rep-inv-new",
  corporateEntities: null,
  directorKycStatus: null,
  directorAmlStatus: null,
  supplements: SUPPLEMENT_A_APPROVED,
};

describe("director-shareholder-notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("issuer", () => {
    it("sends action-required only once for the same CTOS report id + party key", async () => {
      (prisma.notification.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "existing-by-key" });

      const payload = {
        ...baseIssuerPayload,
        newCtosReportId: "rep-same",
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

      await runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert(baseIssuerPayload);

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

  describe("investor company", () => {
    it("sends investor action-required to org owner for new party", async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert(baseInvestorPayload);

      expect(sendTyped).toHaveBeenCalledTimes(1);
      expect(sendTyped).toHaveBeenCalledWith(
        "inv-user-1",
        NotificationTypeIds.INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
        {
          investorOrganizationId: "inv-org-1",
          partyKey: "801234567890",
          personName: "Director B",
          link: "/profile",
        },
        "ds_action_required:investor:inv-org-1:rep-inv-new:801234567890"
      );
    });

    it("does not send when CTOS after snapshot has no visible individuals", async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert({
        ...baseInvestorPayload,
        afterCompanyJson: CTOS_EMPTY,
      });

      expect(sendTyped).not.toHaveBeenCalled();
    });

    it("does not send when party was already in before snapshot", async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert({
        ...baseInvestorPayload,
        beforeCompanyJson: CTOS_DIRECTORS_A_AND_B,
        afterCompanyJson: CTOS_DIRECTORS_A_AND_B,
      });

      expect(sendTyped).not.toHaveBeenCalled();
    });
  });

  describe("shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert", () => {
    it("allows issuer company org notifications", () => {
      expect(
        shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert({
          portal: "issuer",
          organizationType: "COMPANY",
          ownerUserId: "user-1",
        })
      ).toBe(true);
    });

    it("allows investor company org notifications", () => {
      expect(
        shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert({
          portal: "investor",
          organizationType: "COMPANY",
          ownerUserId: "user-1",
        })
      ).toBe(true);
    });

    it("blocks investor personal org notifications", () => {
      expect(
        shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert({
          portal: "investor",
          organizationType: "PERSONAL",
          ownerUserId: "user-1",
        })
      ).toBe(false);
    });

    it("blocks when skip flag is set", () => {
      expect(
        shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert({
          portal: "investor",
          organizationType: "COMPANY",
          ownerUserId: "user-1",
          skipDirectorShareholderNotifications: true,
        })
      ).toBe(false);
    });
  });

  describe("notification type seed scope", () => {
    it("registers investor director/shareholder action required for investor portal only", () => {
      const investorType = initialNotificationTypes.find(
        (t) => t.id === "investor_director_shareholder_action_required"
      );
      expect(investorType).toBeDefined();
      expect(investorType?.portal_targets).toEqual([NotificationPortalTarget.INVESTOR]);
      expect(investorType?.enabled_platform).toBe(true);
      expect(investorType?.enabled_email).toBe(true);
      expect(investorType?.user_configurable).toBe(false);
    });

    it("keeps issuer director/shareholder action required for issuer portal only", () => {
      const issuerType = initialNotificationTypes.find(
        (t) => t.id === "director_shareholder_action_required"
      );
      expect(issuerType).toBeDefined();
      expect(issuerType?.portal_targets).toEqual([NotificationPortalTarget.ISSUER]);
    });
  });
});
