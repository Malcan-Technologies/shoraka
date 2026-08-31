import { NoteFundingStatus, NoteServicingStatus, NoteStatus, WithdrawalStatus, WithdrawalType } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

const mockNoteRepository = {
  findById: jest.fn(),
};

const mockPrisma: any = {
  withdrawalInstruction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  note: {
    findUnique: jest.fn(),
  },
  paymasterAssignmentNotice: {
    findFirst: jest.fn().mockResolvedValue({ status: "ACKNOWLEDGED" }),
  },
  $transaction: jest.fn(),
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("./repository", () => ({
  noteRepository: mockNoteRepository,
  noteInclude: {},
}));

jest.mock("./mapper", () => ({
  mapNoteDetail: jest.fn(),
  mapNoteListItem: jest.fn((note: { id: string }) => ({ id: note.id })),
}));

jest.mock("../notification/note-lifecycle-notifications", () => {
  const actual = jest.requireActual("../notification/note-lifecycle-notifications") as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    notifyNoteActivated: jest.fn(),
    notifyIssuerDisbursementCompleted: jest.fn(),
    notifyNoteActiveInvestors: jest.fn(),
    resolveNoteNotificationTitle: jest.fn(() => "Note 1"),
  };
});

jest.mock("../notification/investor-withdrawal-notifications", () => ({
  notifyInvestorCashWithdrawalSubmitted: jest.fn(),
  notifyInvestorCashWithdrawalCompleted: jest.fn(),
}));

import { NoteService } from "./service";
import {
  notifyIssuerDisbursementCompleted,
  notifyNoteActivated,
  notifyNoteActiveInvestors,
} from "../notification/note-lifecycle-notifications";
import {
  notifyInvestorCashWithdrawalCompleted,
} from "../notification/investor-withdrawal-notifications";

describe("NoteService activate tenure disbursement date", () => {
  const actor = {
    userId: "admin_1",
    role: "ADMIN",
    portal: "ADMIN",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.withdrawalInstruction.findFirst.mockResolvedValue(null);
  });

  it("requires an actual disbursement date for tenure notes", async () => {
    mockNoteRepository.findById.mockResolvedValue({
      id: "note_1",
      tenure_days: 90,
      funding_status: NoteFundingStatus.FUNDED,
      status: NoteStatus.FUNDING,
      servicing_status: NoteServicingStatus.NOT_STARTED,
    });
    const service = new NoteService();

    await expect(service.activate("note_1", actor)).rejects.toMatchObject({
      code: "DISBURSEMENT_VALUE_DATE_INVALID",
      statusCode: 400,
    } satisfies Partial<AppError>);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps legacy activation without a disbursement date", async () => {
    mockNoteRepository.findById.mockResolvedValue({
      id: "note_legacy",
      tenure_days: null,
      funding_status: NoteFundingStatus.FUNDED,
      status: NoteStatus.FUNDING,
      servicing_status: NoteServicingStatus.NOT_STARTED,
    });

    const tx = {
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "note_legacy",
          issuer_organization_id: "org_1",
          tenure_days: null,
        }),
      },
      notePaymentSchedule: {
        updateMany: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (client: typeof tx) => unknown) =>
      cb(tx)
    );

    const service = new NoteService();
    jest.spyOn(service as any, "postDisbursementLedger").mockResolvedValue(undefined);
    jest.spyOn(service as any, "logAdminAction").mockResolvedValue(undefined);

    await service.activate("note_legacy", actor);

    expect(tx.note.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activated_at: expect.any(Date),
        }),
      })
    );
    const data = tx.note.updateMany.mock.calls[0][0].data;
    expect(data.disbursement_value_date).toBeUndefined();
    expect(data.maturity_date).toBeUndefined();
    expect(tx.notePaymentSchedule.updateMany).not.toHaveBeenCalled();
  });

  it("sets value date, activated date, maturity, and schedule for tenure notes", async () => {
    mockNoteRepository.findById.mockResolvedValue({
      id: "note_1",
      tenure_days: 90,
      funding_status: NoteFundingStatus.FUNDED,
      status: NoteStatus.FUNDING,
      servicing_status: NoteServicingStatus.NOT_STARTED,
    });

    const tx = {
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "note_1",
          issuer_organization_id: "org_1",
          tenure_days: 90,
        }),
      },
      notePaymentSchedule: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (client: typeof tx) => unknown) =>
      cb(tx)
    );

    const service = new NoteService();
    jest.spyOn(service as any, "postDisbursementLedger").mockResolvedValue(undefined);
    jest.spyOn(service as any, "logAdminAction").mockResolvedValue(undefined);

    await service.activate("note_1", actor, { disbursementValueDate: "2026-08-20" });

    expect(tx.note.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activated_at: new Date("2026-08-20T00:00:00.000Z"),
          disbursement_value_date: new Date("2026-08-20T00:00:00.000Z"),
          maturity_date: new Date("2026-11-18T00:00:00.000Z"),
        }),
      })
    );
    expect(tx.notePaymentSchedule.updateMany).toHaveBeenCalledWith({
      where: { note_id: "note_1", sequence: 1 },
      data: { due_date: new Date("2026-11-18T00:00:00.000Z") },
    });
  });
});

describe("NoteService markWithdrawalCompleted tenure disbursement date", () => {
  const actor = {
    userId: "admin_1",
    role: "ADMIN",
    portal: "ADMIN",
  };

  function issuerDisbursement(overrides: Record<string, unknown> = {}) {
    return {
      id: "w_1",
      note_id: "note_1",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
      amount: 10000,
      settlement_id: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires an actual disbursement date for tenure issuer disbursements", async () => {
    mockPrisma.withdrawalInstruction.findUnique.mockResolvedValue(issuerDisbursement());
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note_1",
      source_contract_id: null,
      source_invoice_id: "inv_1",
      source_application_id: "app_1",
      tenure_days: 90,
    });
    const service = new NoteService();

    await expect(service.markWithdrawalCompleted("w_1", actor)).rejects.toMatchObject({
      code: "DISBURSEMENT_VALUE_DATE_INVALID",
      statusCode: 400,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps legacy issuer disbursement completion without a disbursement date", async () => {
    mockPrisma.withdrawalInstruction.findUnique.mockResolvedValue(issuerDisbursement());
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note_1",
      source_contract_id: null,
      source_invoice_id: "inv_1",
      source_application_id: "app_1",
      tenure_days: null,
    });

    const tx = {
      shorakaTradeOrder: {
        findUnique: jest.fn().mockResolvedValue({ certificate_s3_key: "certs/shoraka.pdf" }),
      },
      withdrawalInstruction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(issuerDisbursement({ status: WithdrawalStatus.COMPLETED })),
      },
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notePaymentSchedule: {
        updateMany: jest.fn(),
      },
      noteLedgerEntry: {
        create: jest.fn().mockResolvedValue({}),
      },
      noteLedgerAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: "acct_issuer_payable" }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (client: typeof tx) => unknown) =>
      cb(tx)
    );

    const service = new NoteService();
    jest.spyOn(service as any, "getLedgerAccountId").mockResolvedValue("acct_issuer_payable");
    jest.spyOn(service as any, "logEvent").mockResolvedValue(undefined);
    jest.spyOn(service as any, "mapWithdrawal").mockImplementation((row: { id: string }) => ({ id: row.id }));

    await service.markWithdrawalCompleted("w_1", actor);

    const noteData = tx.note.updateMany.mock.calls[0][0].data;
    expect(noteData.activated_at).toEqual(expect.any(Date));
    expect(noteData.disbursement_value_date).toBeUndefined();
    expect(noteData.maturity_date).toBeUndefined();
    expect(tx.notePaymentSchedule.updateMany).not.toHaveBeenCalled();
    expect(tx.withdrawalInstruction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          completed_at: expect.any(Date),
        }),
      })
    );
    const completedAt = tx.withdrawalInstruction.updateMany.mock.calls[0][0].data.completed_at;
    expect(completedAt).not.toEqual(new Date("2026-08-20T00:00:00.000Z"));
  });

  it("sets value date, activated date, maturity, and schedule for tenure issuer disbursements", async () => {
    mockPrisma.withdrawalInstruction.findUnique.mockResolvedValue(issuerDisbursement());
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note_1",
      source_contract_id: null,
      source_invoice_id: "inv_1",
      source_application_id: "app_1",
      tenure_days: 90,
    });

    const tx = {
      shorakaTradeOrder: {
        findUnique: jest.fn().mockResolvedValue({ certificate_s3_key: "certs/shoraka.pdf" }),
      },
      withdrawalInstruction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(issuerDisbursement({ status: WithdrawalStatus.COMPLETED })),
      },
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notePaymentSchedule: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      noteLedgerEntry: {
        create: jest.fn().mockResolvedValue({}),
      },
      noteLedgerAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: "acct_issuer_payable" }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (client: typeof tx) => unknown) =>
      cb(tx)
    );

    const service = new NoteService();
    jest.spyOn(service as any, "getLedgerAccountId").mockResolvedValue("acct_issuer_payable");
    jest.spyOn(service as any, "logEvent").mockResolvedValue(undefined);
    jest.spyOn(service as any, "mapWithdrawal").mockImplementation((row: { id: string }) => ({ id: row.id }));

    await service.markWithdrawalCompleted("w_1", actor, { disbursementValueDate: "2026-08-20" });

    expect(tx.note.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activated_at: new Date("2026-08-20T00:00:00.000Z"),
          disbursement_value_date: new Date("2026-08-20T00:00:00.000Z"),
          maturity_date: new Date("2026-11-18T00:00:00.000Z"),
        }),
      })
    );
    expect(tx.notePaymentSchedule.updateMany).toHaveBeenCalledWith({
      where: { note_id: "note_1", sequence: 1 },
      data: { due_date: new Date("2026-11-18T00:00:00.000Z") },
    });
    const completedAt = tx.withdrawalInstruction.updateMany.mock.calls[0][0].data.completed_at;
    expect(completedAt).toEqual(expect.any(Date));
    expect(completedAt).not.toEqual(new Date("2026-08-20T00:00:00.000Z"));
  });
});

describe("NoteService markWithdrawalCompleted issuer disbursement notifications", () => {
  const actor = {
    userId: "admin_1",
    role: "ADMIN",
    portal: "ADMIN",
  };

  function issuerDisbursement(overrides: Record<string, unknown> = {}) {
    return {
      id: "w_1",
      note_id: "note_1",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
      amount: 10000,
      settlement_id: null,
      ...overrides,
    };
  }

  function completedTx(withdrawal: Record<string, unknown>) {
    return {
      shorakaTradeOrder: {
        findUnique: jest.fn().mockResolvedValue({ certificate_s3_key: "certs/shoraka.pdf" }),
      },
      withdrawalInstruction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...withdrawal,
          status: WithdrawalStatus.COMPLETED,
        }),
      },
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notePaymentSchedule: {
        updateMany: jest.fn(),
      },
      noteLedgerEntry: {
        create: jest.fn().mockResolvedValue({}),
      },
      noteLedgerAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: "acct_issuer_payable" }),
      },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets the note ACTIVE, writes only WITHDRAWAL_COMPLETED, and notifies issuer plus investors", async () => {
    const withdrawal = issuerDisbursement();
    mockPrisma.withdrawalInstruction.findUnique.mockResolvedValue(withdrawal);
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note_1",
      source_contract_id: null,
      source_invoice_id: "inv_1",
      source_application_id: "app_1",
      tenure_days: null,
      title: "Note 1",
      note_reference: "NOTE-001",
      issuer_organization_id: "iss-1",
    });
    const tx = completedTx(withdrawal);
    mockPrisma.$transaction.mockImplementation(async (cb: (client: typeof tx) => unknown) => cb(tx));

    const service = new NoteService();
    jest.spyOn(service as any, "getLedgerAccountId").mockResolvedValue("acct_issuer_payable");
    const logEvent = jest.spyOn(service as any, "logEvent").mockResolvedValue(undefined);
    jest.spyOn(service as any, "mapWithdrawal").mockImplementation((row: { id: string }) => ({ id: row.id }));

    await service.markWithdrawalCompleted("w_1", actor);

    expect(tx.note.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: NoteStatus.FUNDING }),
        data: expect.objectContaining({
          status: NoteStatus.ACTIVE,
          servicing_status: NoteServicingStatus.CURRENT,
        }),
      })
    );
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(
      mockPrisma,
      "note_1",
      "WITHDRAWAL_COMPLETED",
      actor,
      expect.objectContaining({ withdrawalId: "w_1", amount: 10000 })
    );
    expect(logEvent.mock.calls.some((call) => call[2] === "ACTIVATE")).toBe(false);
    expect(notifyNoteActivated).not.toHaveBeenCalled();
    expect(notifyIssuerDisbursementCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: "note_1",
        noteTitle: "Note 1",
        issuerOrganizationId: "iss-1",
        withdrawalId: "w_1",
      })
    );
    expect(notifyNoteActiveInvestors).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: "note_1",
        noteTitle: "Note 1",
      })
    );
    expect(notifyInvestorCashWithdrawalCompleted).not.toHaveBeenCalled();
  });

  it("does not notify investors for residual or admin withdrawals", async () => {
    const residual = {
      id: "w_residual",
      note_id: "note_1",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN,
      amount: 0,
      settlement_id: null,
    };
    mockPrisma.withdrawalInstruction.findUnique.mockResolvedValue(residual);
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note_1",
      source_contract_id: null,
      source_invoice_id: null,
      source_application_id: null,
      tenure_days: null,
      title: "Note 1",
      note_reference: "NOTE-001",
      issuer_organization_id: "iss-1",
    });
    const tx = {
      withdrawalInstruction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...residual,
          status: WithdrawalStatus.COMPLETED,
        }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (client: typeof tx) => unknown) => cb(tx));

    const service = new NoteService();
    jest.spyOn(service as any, "logEvent").mockResolvedValue(undefined);
    jest.spyOn(service as any, "mapWithdrawal").mockImplementation((row: { id: string }) => ({ id: row.id }));

    await service.markWithdrawalCompleted("w_residual", actor);

    expect(notifyNoteActiveInvestors).not.toHaveBeenCalled();
    expect(notifyIssuerDisbursementCompleted).not.toHaveBeenCalled();
    expect(notifyNoteActivated).not.toHaveBeenCalled();
    expect(notifyInvestorCashWithdrawalCompleted).not.toHaveBeenCalled();
  });

  it("does not re-notify when a completed withdrawal is submitted again", async () => {
    mockPrisma.withdrawalInstruction.findUnique.mockResolvedValue(
      issuerDisbursement({ status: WithdrawalStatus.COMPLETED })
    );

    const service = new NoteService();
    const logEvent = jest.spyOn(service as any, "logEvent").mockResolvedValue(undefined);

    await expect(service.markWithdrawalCompleted("w_1", actor)).rejects.toMatchObject({
      code: "WITHDRAWAL_NOT_SUBMITTED",
      statusCode: 409,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
    expect(notifyIssuerDisbursementCompleted).not.toHaveBeenCalled();
    expect(notifyNoteActiveInvestors).not.toHaveBeenCalled();
    expect(notifyNoteActivated).not.toHaveBeenCalled();
    expect(notifyInvestorCashWithdrawalCompleted).not.toHaveBeenCalled();
  });

  it("notifies the requesting investor once when an investor cash withdrawal completes", async () => {
    const withdrawal = {
      id: "w_inv",
      note_id: null,
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
      withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
      amount: 1500,
      settlement_id: null,
      requested_by_user_id: "inv-user-1",
    };
    mockPrisma.withdrawalInstruction.findUnique.mockResolvedValue(withdrawal);
    mockPrisma.note.findUnique.mockResolvedValue(null);
    const tx = {
      withdrawalInstruction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...withdrawal,
          status: WithdrawalStatus.COMPLETED,
        }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (client: typeof tx) => unknown) => cb(tx));

    const service = new NoteService();
    jest.spyOn(service as any, "logEvent").mockResolvedValue(undefined);
    jest.spyOn(service as any, "mapWithdrawal").mockImplementation((row: { id: string }) => ({ id: row.id }));

    await service.markWithdrawalCompleted("w_inv", actor);

    expect(notifyInvestorCashWithdrawalCompleted).toHaveBeenCalledTimes(1);
    expect(notifyInvestorCashWithdrawalCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        withdrawalId: "w_inv",
        requestedByUserId: "inv-user-1",
        amount: 1500,
        withdrawalType: WithdrawalType.INVESTOR_WITHDRAWAL,
      })
    );
    expect(notifyIssuerDisbursementCompleted).not.toHaveBeenCalled();
    expect(notifyNoteActiveInvestors).not.toHaveBeenCalled();
  });

  it("does not re-notify when a completed investor cash withdrawal is submitted again", async () => {
    mockPrisma.withdrawalInstruction.findUnique.mockResolvedValue({
      id: "w_inv",
      note_id: null,
      status: WithdrawalStatus.COMPLETED,
      withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
      amount: 1500,
      requested_by_user_id: "inv-user-1",
    });

    const service = new NoteService();
    await expect(service.markWithdrawalCompleted("w_inv", actor)).rejects.toMatchObject({
      code: "WITHDRAWAL_NOT_SUBMITTED",
      statusCode: 409,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(notifyInvestorCashWithdrawalCompleted).not.toHaveBeenCalled();
  });
});
