/**
 * Smoke wiring: lifecycle helpers must load before NoteService so they receive mocks.
 */
jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(() => ({ id: "note-1" })),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: {
    findById: jest.fn(),
  },
}));

jest.mock("../notification/note-lifecycle-notifications", () => {
  const actual =
    jest.requireActual<typeof import("../notification/note-lifecycle-notifications")>(
      "../notification/note-lifecycle-notifications"
    );
  return {
    ...actual,
    notifyNotePaymentReceived: jest.fn().mockResolvedValue(undefined),
    notifyNoteSettlementPosted: jest.fn().mockResolvedValue(undefined),
    notifyNoteIssuerRepaid: jest.fn().mockResolvedValue(undefined),
  };
});

import {
  NoteFundingStatus,
  NotePaymentSource,
  NoteServicingStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import * as noteLifecycle from "../notification/note-lifecycle-notifications";
import { noteRepository } from "./repository";
import { NoteService } from "./service";

describe("NoteService notification triggers", () => {
  const actor = { userId: "admin-1", role: "ADMIN", portal: "ADMIN" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("recordPayment invokes notifyNotePaymentReceived when payment is RECEIVED immediately", async () => {
    const minimalNote = {
      id: "note-1",
      funding_status: NoteFundingStatus.FUNDED,
      servicing_status: NoteServicingStatus.CURRENT,
      payments: [],
      settlements: [],
      invoice_snapshot: null,
      requested_amount: null,
      title: "N",
      note_reference: null,
      grace_period_days: 0,
      tawidh_rate_cap_percent: new Prisma.Decimal(0),
      gharamah_rate_cap_percent: new Prisma.Decimal(0),
      payment_schedules: [],
      maturity_date: null,
    };
    (noteRepository.findById as jest.Mock).mockResolvedValue(minimalNote);

    const tx = {
      notePayment: {
        create: jest.fn().mockResolvedValue({
          id: "pay-1",
          note_id: "note-1",
          receipt_amount: new Prisma.Decimal("100"),
          source: NotePaymentSource.ADMIN_ADJUSTMENT,
          reference: null as string | null,
        }),
      },
      noteEvent: { create: jest.fn().mockResolvedValue({}) },
      noteLedgerAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: "acct-repayment-pool" }),
      },
      noteLedgerEntry: { upsert: jest.fn().mockResolvedValue({}) },
      note: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(minimalNote),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    const service = new NoteService();
    await service.recordPayment(
      "note-1",
      {
        source: NotePaymentSource.ADMIN_ADJUSTMENT,
        receiptAmount: 100,
        receiptDate: new Date().toISOString(),
      },
      actor
    );

    expect(noteLifecycle.notifyNotePaymentReceived).toHaveBeenCalledTimes(1);
    expect(noteLifecycle.notifyNotePaymentReceived).toHaveBeenCalledWith({
      notificationService: expect.any(Object),
      noteId: "note-1",
      noteTitle: "N",
      paymentId: "pay-1",
    });
  });
});
