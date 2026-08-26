const sendTyped = jest.fn().mockResolvedValue({ id: "n1" });
const logTypedSystemBatch = jest.fn().mockResolvedValue(undefined);

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
  notifyNotePaymentRejected,
  notifyIssuerDisbursementCompleted,
  isIssuerFinancingDisbursement,
  notifyNoteActivated,
  notifyNoteActiveInvestors,
  notifyNotePublished,
  notifyNoteSettlementPosted,
  resolveNoteNotificationTitle,
} from "./note-lifecycle-notifications";
import { NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";
import { prisma } from "../../lib/prisma";

describe("resolveNoteNotificationTitle", () => {
  it("uses title then reference then fallback", () => {
    expect(resolveNoteNotificationTitle({ title: " Hello ", note_reference: "N-1" })).toBe("Hello");
    expect(resolveNoteNotificationTitle({ title: "", note_reference: " NR " })).toBe("NR");
    expect(resolveNoteNotificationTitle({ title: null, note_reference: null })).toBe("Note");
  });
});

describe("notifyNotePublished", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "UOWN",
    });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([
      { user_id: "UM1" },
      { user_id: "UM2" },
    ]);
  });

  it("notifies issuer owner and all org members via sendTyped", async () => {
    const notificationService = {
      sendTyped,
      logTypedSystemBatch,
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
    expect(sendTyped).toHaveBeenCalledTimes(3);
    expect(sendTyped).toHaveBeenCalledWith(
      "UOWN",
      NotificationTypeIds.NOTE_PUBLISHED,
      { noteId: "note-1", noteTitle: "T1" },
      "note:lifecycle:note-1:published:user:UOWN"
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
    expect(logTypedSystemBatch).toHaveBeenCalledWith(
      NotificationTypeIds.NOTE_PUBLISHED,
      { noteId: "note-1", noteTitle: "T1" },
      [{ id: "n1" }, { id: "n1" }, { id: "n1" }],
      {
        idempotencyKey: "system-log:note_published:note:lifecycle:note-1:published",
      }
    );
  });
});

describe("notifyNoteFundingFailed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "IOWN",
    });
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "INVOWN",
    });
    (prisma.organizationMember.findMany as jest.Mock).mockImplementation(
      async (args: {
        where: { issuer_organization_id?: string; investor_organization_id?: string };
      }) => {
        if (args.where.issuer_organization_id) {
          return [{ user_id: "IA1" }];
        }
        return [{ user_id: "IB1" }];
      }
    );
  });

  it("notifies issuer org and each failed-funding investor org", async () => {
    const notificationService = {
      sendTyped,
      logTypedSystemBatch,
    } as unknown as NotificationService;

    await notifyNoteFundingFailed({
      notificationService,
      noteId: "n2",
      issuerOrganizationId: "iss-2",
      noteTitle: "T2",
      failedInvestorOrganizationIds: ["inv-a", "inv-b"],
    });

    const issuerCalls = sendTyped.mock.calls.filter(
      (c) => c[1] === NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER
    );
    const investorCalls = sendTyped.mock.calls.filter(
      (c) => c[1] === NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR
    );
    expect(issuerCalls.length).toBe(2);
    expect(investorCalls.length).toBe(4);
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(2);
    expect(logTypedSystemBatch).toHaveBeenCalledWith(
      NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER,
      expect.any(Object),
      expect.any(Array),
      {
        idempotencyKey:
          "system-log:note_funding_failed_issuer:note:lifecycle:n2:funding_failed:issuer",
      }
    );
    expect(logTypedSystemBatch).toHaveBeenCalledWith(
      NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR,
      expect.any(Object),
      expect.any(Array),
      {
        idempotencyKey:
          "system-log:note_funding_failed_investor:note:lifecycle:n2:funding_failed:investor",
      }
    );
  });
});

describe("notifyNoteIssuerRepaid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "SOWN",
    });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([{ user_id: "S1" }]);
  });

  it("notifies issuer members only", async () => {
    const notificationService = {
      sendTyped,
      logTypedSystemBatch,
    } as unknown as NotificationService;

    await notifyNoteIssuerRepaid({
      notificationService,
      noteId: "n-issuer-repaid",
      issuerOrganizationId: "iss-x",
      noteTitle: "Tx",
    });

    expect(sendTyped.mock.calls.every((c) => c[1] === NotificationTypeIds.NOTE_REPAID_ISSUER)).toBe(
      true
    );
    expect(sendTyped).toHaveBeenCalledTimes(2);
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
    expect(logTypedSystemBatch).toHaveBeenCalledWith(
      NotificationTypeIds.NOTE_REPAID_ISSUER,
      { noteId: "n-issuer-repaid", noteTitle: "Tx" },
      [{ id: "n1" }, { id: "n1" }],
      {
        idempotencyKey: "system-log:note_repaid_issuer:note:lifecycle:n-issuer-repaid:repaid:issuer",
      }
    );
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
      sendTyped,
      logTypedSystemBatch,
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
    expect(sendTyped).toHaveBeenCalledTimes(3);
    expect(sendTyped).toHaveBeenCalledWith(
      "INVOWN",
      NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
      { noteId: "note-pay", noteTitle: "Pay title" },
      "note:lifecycle:note-pay:payment_received:pay-99:investor-org:inv-org-1:user:INVOWN"
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
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
      sendTyped,
      logTypedSystemBatch,
    } as unknown as NotificationService;

    await notifyNoteSettlementPosted({
      notificationService,
      noteId: "n-settle",
      noteTitle: "St",
      settlementId: "set-1",
      investorOrganizationIds: ["org-a", "org-b"],
    });

    expect(prisma.noteInvestment.findMany).not.toHaveBeenCalled();
    const settlementCalls = sendTyped.mock.calls.filter(
      (c) => c[1] === NotificationTypeIds.NOTE_SETTLEMENT_POSTED
    );
    expect(settlementCalls.length).toBe(4);
    expect(settlementCalls[0]?.[3]).toContain("settlement_posted:set-1");
  });
});

describe("isIssuerFinancingDisbursement", () => {
  it("is true only for ISSUER_DISBURSEMENT", () => {
    expect(isIssuerFinancingDisbursement("ISSUER_DISBURSEMENT")).toBe(true);
    expect(isIssuerFinancingDisbursement("ISSUER_RESIDUAL_RETURN")).toBe(false);
    expect(isIssuerFinancingDisbursement("INVESTOR_WITHDRAWAL")).toBe(false);
    expect(isIssuerFinancingDisbursement("ADMIN_ADJUSTMENT")).toBe(false);
    expect(isIssuerFinancingDisbursement(null)).toBe(false);
  });
});

describe("notifyNotePaymentRejected", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({ owner_user_id: "WOWN" });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([{ user_id: "UM1" }]);
  });

  it("notifies the issuer org with a payment-scoped idempotency key", async () => {
    const notificationService = {
      sendTyped,
      logTypedSystemBatch,
    } as unknown as NotificationService;

    await notifyNotePaymentRejected({
      notificationService,
      noteId: "note-1",
      noteTitle: "Note One",
      issuerOrganizationId: "iss-1",
      paymentId: "pay-9",
    });

    expect(sendTyped).toHaveBeenCalledTimes(2);
    expect(sendTyped).toHaveBeenCalledWith(
      "WOWN",
      NotificationTypeIds.NOTE_PAYMENT_REJECTED,
      { noteId: "note-1", noteTitle: "Note One" },
      "note:lifecycle:note-1:payment_rejected:pay-9:user:WOWN"
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
  });
});

describe("notifyIssuerDisbursementCompleted", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({ owner_user_id: "WOWN" });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([{ user_id: "UM1" }]);
  });

  it("notifies the issuer org with a withdrawal-scoped idempotency key", async () => {
    const notificationService = {
      sendTyped,
      logTypedSystemBatch,
    } as unknown as NotificationService;

    await notifyIssuerDisbursementCompleted({
      notificationService,
      noteId: "note-1",
      noteTitle: "Note One",
      issuerOrganizationId: "iss-1",
      withdrawalId: "wd-9",
    });

    expect(sendTyped).toHaveBeenCalledWith(
      "WOWN",
      NotificationTypeIds.WITHDRAWAL_COMPLETED,
      { noteId: "note-1", noteTitle: "Note One" },
      "withdrawal:lifecycle:wd-9:issuer_disbursement_completed:user:WOWN"
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
    expect(sendTyped.mock.calls.every((c) => c[1] !== NotificationTypeIds.NOTE_ACTIVE_ISSUER)).toBe(
      true
    );
    expect(sendTyped.mock.calls.every((c) => c[1] !== NotificationTypeIds.NOTE_ACTIVE_INVESTOR)).toBe(
      true
    );
  });
});

describe("notifyNoteActiveInvestors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.noteInvestment.findMany as jest.Mock).mockResolvedValue([
      { investor_organization_id: "inv-org-1" },
    ]);
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "INVOWN",
    });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([{ user_id: "IV1" }]);
  });

  it("notifies confirmed investors with note_active_investor only", async () => {
    const notificationService = {
      sendTyped,
      logTypedSystemBatch,
    } as unknown as NotificationService;

    await notifyNoteActiveInvestors({
      notificationService,
      noteId: "note-1",
      noteTitle: "Note One",
    });

    expect(prisma.noteInvestment.findMany).toHaveBeenCalledWith({
      where: { note_id: "note-1", status: { in: ["CONFIRMED"] } },
      select: { investor_organization_id: true },
      distinct: ["investor_organization_id"],
    });
    expect(sendTyped).toHaveBeenCalledTimes(2);
    expect(sendTyped.mock.calls.every((c) => c[1] === NotificationTypeIds.NOTE_ACTIVE_INVESTOR)).toBe(
      true
    );
    expect(sendTyped).toHaveBeenCalledWith(
      "INVOWN",
      NotificationTypeIds.NOTE_ACTIVE_INVESTOR,
      { noteId: "note-1", noteTitle: "Note One" },
      "note:lifecycle:note-1:active:investor:investor-org:inv-org-1:user:INVOWN"
    );
    expect(sendTyped.mock.calls.every((c) => c[1] !== NotificationTypeIds.NOTE_ACTIVE_ISSUER)).toBe(
      true
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(1);
  });
});

describe("notifyNoteActivated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({ owner_user_id: "WOWN" });
    (prisma.noteInvestment.findMany as jest.Mock).mockResolvedValue([
      { investor_organization_id: "inv-org-1" },
    ]);
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "INVOWN",
    });
    (prisma.organizationMember.findMany as jest.Mock).mockImplementation(
      async (args: {
        where: { issuer_organization_id?: string; investor_organization_id?: string };
      }) => {
        if (args.where.issuer_organization_id) {
          return [{ user_id: "UM1" }];
        }
        return [{ user_id: "IV1" }];
      }
    );
  });

  it("sends note_active_issuer to the issuer org and note_active_investor to confirmed investors", async () => {
    const notificationService = {
      sendTyped,
      logTypedSystemBatch,
    } as unknown as NotificationService;

    await notifyNoteActivated({
      notificationService,
      noteId: "note-1",
      issuerOrganizationId: "iss-1",
      noteTitle: "Note One",
    });

    const issuerCalls = sendTyped.mock.calls.filter(
      (c) => c[1] === NotificationTypeIds.NOTE_ACTIVE_ISSUER
    );
    const investorCalls = sendTyped.mock.calls.filter(
      (c) => c[1] === NotificationTypeIds.NOTE_ACTIVE_INVESTOR
    );
    expect(issuerCalls.length).toBe(2);
    expect(investorCalls.length).toBe(2);
    expect(issuerCalls[0]?.[3]).toBe("note:lifecycle:note-1:active:issuer:user:WOWN");
    expect(investorCalls[0]?.[3]).toBe(
      "note:lifecycle:note-1:active:investor:investor-org:inv-org-1:user:INVOWN"
    );
    expect(logTypedSystemBatch).toHaveBeenCalledTimes(2);
  });
});
