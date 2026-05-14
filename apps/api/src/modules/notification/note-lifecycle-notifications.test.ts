const sendTypedPlatformOnly = jest.fn().mockResolvedValue({ id: "n1" });

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: {
      findUnique: jest.fn(),
    },
    investorOrganization: {
      findUnique: jest.fn(),
    },
    organizationMember: {
      findMany: jest.fn(),
    },
    noteInvestment: {
      findMany: jest.fn(),
    },
  },
}));
import {
  notifyNoteFundingFailed,
  notifyNoteIssuerRepaid,
  notifyNotePaymentReceived,
  notifyNotePublished,
  notifyNoteSettlementPosted,
  resolveNoteNotificationTitle,
} from "./note-lifecycle-notifications";
import { NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";
import { prisma } from "../../lib/prisma";

describe("resolveNoteNotificationTitle", () => {
  it("uses title then reference then fallback", () => {
    expect(resolveNoteNotificationTitle({ title: " Hello ", note_reference: "N-1" })).toBe(
      "Hello"
    );
    expect(resolveNoteNotificationTitle({ title: "", note_reference: " NR " })).toBe("NR");
    expect(resolveNoteNotificationTitle({ title: null, note_reference: null })).toBe("Note");
  });
});

describe("notifyNotePublished", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({ owner_user_id: "UOWN" });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([
      { user_id: "UM1" },
      { user_id: "UM2" },
    ]);
  });

  it("notifies issuer owner and all org members via platform-only channel", async () => {
    const notificationService = {
      sendTypedPlatformOnly,
    } as unknown as NotificationService;

    await notifyNotePublished({
      notificationService,
      noteId: "note-1",
      issuerOrganizationId: "iss-1",
      noteTitle: "T1",
    });

    expect(prisma.issuerOrganization.findUnique).toHaveBeenCalledWith({
      where: { id: "iss-1" },
      select: { owner_user_id: true },
    });
    expect(prisma.organizationMember.findMany).toHaveBeenCalledWith({
      where: { issuer_organization_id: "iss-1" },
      select: { user_id: true },
    });
    expect(sendTypedPlatformOnly).toHaveBeenCalledTimes(3);
    expect(sendTypedPlatformOnly).toHaveBeenCalledWith(
      "UOWN",
      NotificationTypeIds.NOTE_PUBLISHED,
      { noteId: "note-1", noteTitle: "T1" },
      "note:lifecycle:note-1:published:user:UOWN"
    );
  });
});

describe("notifyNoteFundingFailed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({ owner_user_id: "IOWN" });
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "INVOWN",
    });
    (prisma.organizationMember.findMany as jest.Mock).mockImplementation(
      async (args: { where: { issuer_organization_id?: string; investor_organization_id?: string } }) => {
        if (args.where.issuer_organization_id) {
          return [{ user_id: "IA1" }];
        }
        return [{ user_id: "IB1" }];
      }
    );
  });

  it("notifies issuer org and each failed-funding investor org", async () => {
    const notificationService = {
      sendTypedPlatformOnly,
    } as unknown as NotificationService;

    await notifyNoteFundingFailed({
      notificationService,
      noteId: "n2",
      issuerOrganizationId: "iss-2",
      noteTitle: "T2",
      failedInvestorOrganizationIds: ["inv-a", "inv-b"],
    });

    const issuerCalls = sendTypedPlatformOnly.mock.calls.filter(
      (c) => c[1] === NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER
    );
    const investorCalls = sendTypedPlatformOnly.mock.calls.filter(
      (c) => c[1] === NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR
    );
    expect(issuerCalls.length).toBe(2);
    expect(investorCalls.length).toBe(4);
  });
});

describe("notifyNoteIssuerRepaid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({ owner_user_id: "SOWN" });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([{ user_id: "S1" }]);
  });

  it("notifies issuer members only", async () => {
    const notificationService = {
      sendTypedPlatformOnly,
    } as unknown as NotificationService;

    await notifyNoteIssuerRepaid({
      notificationService,
      noteId: "n-issuer-repaid",
      issuerOrganizationId: "iss-x",
      noteTitle: "Tx",
    });

    expect(sendTypedPlatformOnly.mock.calls.every((c) => c[1] === NotificationTypeIds.NOTE_REPAID_ISSUER)).toBe(
      true
    );
    expect(sendTypedPlatformOnly).toHaveBeenCalledTimes(2);
  });
});

describe("notifyNotePaymentReceived", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.noteInvestment.findMany as jest.Mock).mockResolvedValue([
      { investor_organization_id: "inv-org-1" },
    ]);
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "INVOWN",
    });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([
      { user_id: "IV1" },
      { user_id: "IV2" },
    ]);
  });

  it("notifies confirmed investor org members with payment-scoped idempotency", async () => {
    const notificationService = {
      sendTypedPlatformOnly,
    } as unknown as NotificationService;

    await notifyNotePaymentReceived({
      notificationService,
      noteId: "note-pay",
      noteTitle: "Pay title",
      paymentId: "pay-99",
    });

    expect(prisma.noteInvestment.findMany).toHaveBeenCalledWith({
      where: { note_id: "note-pay", status: { in: ["CONFIRMED"] } },
      select: { investor_organization_id: true },
      distinct: ["investor_organization_id"],
    });
    expect(sendTypedPlatformOnly).toHaveBeenCalledTimes(3);
    expect(sendTypedPlatformOnly).toHaveBeenCalledWith(
      "INVOWN",
      NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
      { noteId: "note-pay", noteTitle: "Pay title" },
      "note:lifecycle:note-pay:payment_received:pay-99:investor-org:inv-org-1:user:INVOWN"
    );
  });
});

describe("notifyNoteSettlementPosted", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "OWN",
    });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([{ user_id: "U1" }]);
  });

  it("fans out to snapshot investor org ids with settlement-scoped idempotency", async () => {
    const notificationService = {
      sendTypedPlatformOnly,
    } as unknown as NotificationService;

    await notifyNoteSettlementPosted({
      notificationService,
      noteId: "n-settle",
      noteTitle: "St",
      settlementId: "set-1",
      investorOrganizationIds: ["org-a", "org-b"],
    });

    expect(prisma.noteInvestment.findMany).not.toHaveBeenCalled();
    const settlementCalls = sendTypedPlatformOnly.mock.calls.filter(
      (c) => c[1] === NotificationTypeIds.NOTE_SETTLEMENT_POSTED
    );
    expect(settlementCalls.length).toBe(4);
    expect(settlementCalls[0]?.[3]).toContain("settlement_posted:set-1");
  });
});
