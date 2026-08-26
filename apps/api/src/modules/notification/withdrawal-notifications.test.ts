import { WithdrawalType } from "@prisma/client";
import { getNotificationContent, NotificationTypeIds } from "./registry";
import { initialNotificationTypes } from "./seed-data";
import {
  notifyWithdrawalSubmittedToTrustee,
  resolveWithdrawalNotificationTargets,
  withdrawalSubmittedToTrusteeIdempotencyKey,
} from "./withdrawal-notifications";

const sendTyped = jest.fn().mockResolvedValue({ id: "n1" });
const logTypedSystemBatch = jest.fn().mockResolvedValue(undefined);

jest.mock("./service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped,
    logTypedSystemBatch,
  })),
}));

const mockFindNote = jest.fn();
jest.mock("../../lib/prisma", () => ({
  prisma: {
    note: { findUnique: (...args: unknown[]) => mockFindNote(...args) },
  },
}));

const mockListIssuer = jest.fn();
const mockListInvestor = jest.fn();
jest.mock("./org-member-recipients", () => ({
  listIssuerOrgMemberUserIds: (...args: unknown[]) => mockListIssuer(...args),
  listInvestorOrgMemberUserIds: (...args: unknown[]) => mockListInvestor(...args),
}));

describe("resolveWithdrawalNotificationTargets", () => {
  it("routes investor withdrawals to the investor org only", () => {
    expect(
      resolveWithdrawalNotificationTargets({
        withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
        investor_organization_id: "inv-1",
        issuer_organization_id: "iss-1",
      })
    ).toEqual([{ portal: "investor", organizationId: "inv-1" }]);
  });

  it("routes issuer disbursement and residual return to the issuer org only", () => {
    expect(
      resolveWithdrawalNotificationTargets({
        withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
        investor_organization_id: "inv-1",
        issuer_organization_id: "iss-1",
      })
    ).toEqual([{ portal: "issuer", organizationId: "iss-1" }]);
    expect(
      resolveWithdrawalNotificationTargets({
        withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN,
        investor_organization_id: "inv-1",
        issuer_organization_id: "iss-1",
      })
    ).toEqual([{ portal: "issuer", organizationId: "iss-1" }]);
  });

  it("notifies whichever orgs exist for admin adjustments", () => {
    expect(
      resolveWithdrawalNotificationTargets({
        withdrawal_type: WithdrawalType.ADMIN_ADJUSTMENT,
        investor_organization_id: "inv-1",
        issuer_organization_id: "iss-1",
      })
    ).toEqual([
      { portal: "investor", organizationId: "inv-1" },
      { portal: "issuer", organizationId: "iss-1" },
    ]);
    expect(
      resolveWithdrawalNotificationTargets({
        withdrawal_type: WithdrawalType.ADMIN_ADJUSTMENT,
        investor_organization_id: "inv-1",
        issuer_organization_id: null,
      })
    ).toEqual([{ portal: "investor", organizationId: "inv-1" }]);
  });

  it("returns no targets when the required org is missing", () => {
    expect(
      resolveWithdrawalNotificationTargets({
        withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
        investor_organization_id: null,
        issuer_organization_id: "iss-1",
      })
    ).toEqual([]);
  });
});

describe("catalog cleanup", () => {
  it("no longer seeds superseded notification types", () => {
    const ids = initialNotificationTypes.map((type) => type.id);
    expect(ids).not.toEqual(
      expect.arrayContaining([
        "kyc_approved",
        "kyc_rejected",
        "login_new_device",
        "application_approved",
      ])
    );
    expect(ids).toContain(NotificationTypeIds.PASSWORD_CHANGED);
    expect(ids).toContain(NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE);
    expect(Object.values(NotificationTypeIds)).not.toEqual(
      expect.arrayContaining([
        "kyc_approved",
        "kyc_rejected",
        "login_new_device",
        "application_approved",
      ])
    );
  });
});

describe("withdrawal submitted template", () => {
  it("uses portal-aware investor and issuer note links", () => {
    const investor = getNotificationContent(NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE, {
      withdrawalId: "wd-1",
      noteId: "note-1",
      noteTitle: "Note One",
      noteReference: "N-1",
      displayReference: "WD-1",
      withdrawalType: WithdrawalType.INVESTOR_WITHDRAWAL,
      portalType: "investor",
    });
    expect(investor.linkPath).toBe("/investments/note-1");
    expect(investor.portal).toBe("investor");
    expect(investor.message).toContain("WD-1");
    expect(investor.message).toContain("Note One");

    const issuer = getNotificationContent(NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE, {
      withdrawalId: "wd-1",
      noteId: "note-1",
      noteTitle: "Note One",
      withdrawalType: WithdrawalType.ISSUER_DISBURSEMENT,
      portalType: "issuer",
    });
    expect(issuer.linkPath).toBe("/financing/notes/note-1");
    expect(issuer.portal).toBe("issuer");
  });

  it("uses a stable per-withdrawal/portal/user idempotency key", () => {
    expect(withdrawalSubmittedToTrusteeIdempotencyKey("wd-1", "issuer", "user-1")).toBe(
      `withdrawal:wd-1:notif:${NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE}:issuer:user:user-1`
    );
    expect(withdrawalSubmittedToTrusteeIdempotencyKey("wd-1", "issuer", "user-1")).toBe(
      withdrawalSubmittedToTrusteeIdempotencyKey("wd-1", "issuer", "user-1")
    );
  });
});

describe("notifyWithdrawalSubmittedToTrustee", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindNote.mockResolvedValue({ title: " Note One ", note_reference: "N-1" });
    mockListIssuer.mockResolvedValue(["iss-user"]);
    mockListInvestor.mockResolvedValue(["inv-user"]);
  });

  it("sends portal-specific payloads to investor org members", async () => {
    const summary = await notifyWithdrawalSubmittedToTrustee({
      withdrawal: {
        id: "wd-1",
        note_id: "note-1",
        withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
        display_reference: "WD-1",
        investor_organization_id: "inv-1",
        issuer_organization_id: "iss-1",
      },
    });

    expect(mockListInvestor).toHaveBeenCalledWith("inv-1");
    expect(mockListIssuer).not.toHaveBeenCalled();
    expect(sendTyped).toHaveBeenCalledTimes(1);
    expect(sendTyped).toHaveBeenCalledWith(
      "inv-user",
      NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE,
      expect.objectContaining({
        withdrawalId: "wd-1",
        noteId: "note-1",
        noteTitle: "Note One",
        displayReference: "WD-1",
        withdrawalType: WithdrawalType.INVESTOR_WITHDRAWAL,
        portalType: "investor",
      }),
      withdrawalSubmittedToTrusteeIdempotencyKey("wd-1", "investor", "inv-user")
    );
    expect(summary.skipped).toBe(false);
    expect(summary.attempted).toBe(1);
    expect(summary.delivered).toBe(1);
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
    expect(logTypedSystemBatch).toHaveBeenCalledWith(
      NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE,
      expect.objectContaining({ portalType: "investor" }),
      [{ id: "n1" }],
      {
        idempotencyKey: "system-log:withdrawal_submitted_to_trustee:withdrawal:wd-1:investor",
      }
    );
  });

  it("notifies both orgs for admin adjustments with portal-specific payloads", async () => {
    await notifyWithdrawalSubmittedToTrustee({
      withdrawal: {
        id: "wd-2",
        note_id: "note-2",
        withdrawal_type: WithdrawalType.ADMIN_ADJUSTMENT,
        display_reference: "WD-2",
        investor_organization_id: "inv-1",
        issuer_organization_id: "iss-1",
      },
    });

    expect(sendTyped).toHaveBeenCalledTimes(2);
    expect(sendTyped).toHaveBeenCalledWith(
      "inv-user",
      NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE,
      expect.objectContaining({ portalType: "investor", noteId: "note-2" }),
      withdrawalSubmittedToTrusteeIdempotencyKey("wd-2", "investor", "inv-user")
    );
    expect(sendTyped).toHaveBeenCalledWith(
      "iss-user",
      NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE,
      expect.objectContaining({ portalType: "issuer", noteId: "note-2" }),
      withdrawalSubmittedToTrusteeIdempotencyKey("wd-2", "issuer", "iss-user")
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(2);
  });

  it("skips safely when there is no org target", async () => {
    const summary = await notifyWithdrawalSubmittedToTrustee({
      withdrawal: {
        id: "wd-3",
        note_id: "note-3",
        withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
        investor_organization_id: null,
        issuer_organization_id: null,
      },
    });

    expect(sendTyped).not.toHaveBeenCalled();
    expect(summary).toEqual(
      expect.objectContaining({
        withdrawalId: "wd-3",
        skipped: true,
        skipReason: "no_org_target",
        attempted: 0,
      })
    );
  });

  it("logs the batch when a recipient send throws", async () => {
    sendTyped.mockRejectedValueOnce(new Error("delivery failed"));

    await expect(
      notifyWithdrawalSubmittedToTrustee({
        withdrawal: {
          id: "wd-4",
          note_id: "note-4",
          withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
          issuer_organization_id: "iss-1",
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        withdrawalId: "wd-4",
        skipped: false,
        attempted: 1,
        delivered: 0,
      })
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
    expect(logTypedSystemBatch).toHaveBeenCalledWith(
      NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE,
      expect.objectContaining({ withdrawalId: "wd-4", portalType: "issuer" }),
      [null],
      expect.objectContaining({
        idempotencyKey: expect.stringContaining("withdrawal:wd-4:issuer"),
      })
    );
  });
});
