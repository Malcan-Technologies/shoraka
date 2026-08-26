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
const logTypedSystemBatch = jest.fn().mockResolvedValue(undefined);

jest.mock("./service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped,
    logTypedSystemBatch,
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

const CTOS_DIRECTORS_A_B_AND_C = {
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
    {
      party_type: "I",
      position: "DO",
      nic_brno: "701234567890",
      name: "Director C",
      equity_percentage: null,
    },
  ],
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

    it("sends only to owner user id, never org member id", async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert({
        ...baseIssuerPayload,
        ownerUserId: "issuer-owner-only",
      });

      expect(sendTyped).toHaveBeenCalledWith(
        "issuer-owner-only",
        expect.any(String),
        expect.any(Object),
        expect.any(String)
      );
      expect(sendTyped).not.toHaveBeenCalledWith(
        "issuer-member-user",
        expect.any(String),
        expect.any(Object),
        expect.any(String)
      );
    });

    it("creates one notification per new actionable party", async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert({
        ...baseIssuerPayload,
        afterCompanyJson: CTOS_DIRECTORS_A_B_AND_C,
      });

      expect(sendTyped).toHaveBeenCalledTimes(2);
      expect(sendTyped).toHaveBeenCalledWith(
        "user-1",
        NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
        expect.objectContaining({ partyKey: "801234567890", personName: "Director B" }),
        "ds_action_required:org-1:rep-new:801234567890"
      );
      expect(sendTyped).toHaveBeenCalledWith(
        "user-1",
        NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
        expect.objectContaining({ partyKey: "701234567890", personName: "Director C" }),
        "ds_action_required:org-1:rep-new:701234567890"
      );
      expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
      expect(logTypedSystemBatch).toHaveBeenCalledWith(
        NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
        expect.any(Object),
        [{ id: "n1" }, { id: "n1" }],
        expect.objectContaining({
          idempotencyKey:
            "system-log:director_shareholder_action_required:ds_action_required:issuer:org-1:rep-new",
          metadata: expect.objectContaining({ attempted: 2 }),
        })
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
      expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
      expect(logTypedSystemBatch).toHaveBeenCalledWith(
        NotificationTypeIds.INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
        expect.any(Object),
        [{ id: "n1" }],
        expect.objectContaining({
          idempotencyKey:
            "system-log:investor_director_shareholder_action_required:ds_action_required:investor:inv-org-1:rep-inv-new",
          metadata: expect.objectContaining({ attempted: 1 }),
        })
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

    it("sends only to investor org owner user id", async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert({
        ...baseInvestorPayload,
        ownerUserId: "investor-owner-only",
      });

      expect(sendTyped).toHaveBeenCalledWith(
        "investor-owner-only",
        NotificationTypeIds.INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
        expect.objectContaining({ investorOrganizationId: "inv-org-1" }),
        expect.stringContaining("ds_action_required:investor:")
      );
    });

    it("uses investor-specific idempotency keys that do not collide with issuer keys", async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert(baseInvestorPayload);

      const idempotencyKey = sendTyped.mock.calls[0][3] as string;
      expect(idempotencyKey).toBe(
        "ds_action_required:investor:inv-org-1:rep-inv-new:801234567890"
      );
      expect(idempotencyKey).not.toBe("ds_action_required:inv-org-1:rep-inv-new:801234567890");
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
