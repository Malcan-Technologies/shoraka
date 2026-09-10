/**
 * Smoke wiring: lifecycle helpers must load before NoteService so they receive mocks.
 */
jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(() => ({ id: "note-1" })),
  mapNoteListItem: jest.fn(() => ({ issuerName: "Acme" })),
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

jest.mock("./servicing-letters/service", () => ({
  generateAndSendServicingLetter: jest.fn().mockResolvedValue({
    id: "letter-1",
    s3Key: "letter.pdf",
    sentTo: [],
  }),
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
    notifyNoteDefaulted: jest.fn().mockResolvedValue(undefined),
  };
});

import {
  NoteFundingStatus,
  NotePaymentSource,
  NoteServicingStatus,
  NoteStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import * as noteLifecycle from "../notification/note-lifecycle-notifications";
import { noteRepository } from "./repository";
import { generateAndSendServicingLetter } from "./servicing-letters/service";
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

  it("marks default and writes its audit trail in one conditional transaction", async () => {
    const arrearsNote = {
      id: "note-1",
      status: NoteStatus.ARREARS,
      servicing_status: NoteServicingStatus.ARREARS,
      default_marked_at: null,
      issuer_organization_id: "org-1",
      title: "N",
      note_reference: "NOTE-1",
      issuer_snapshot: null,
      days_past_due: 21,
      funded_amount: new Prisma.Decimal(1000),
      profit_rate_percent: new Prisma.Decimal(10),
      indicative_tawidh_amount: new Prisma.Decimal(1),
      indicative_gharamah_amount: new Prisma.Decimal(4),
      grace_period_days: 7,
      arrears_threshold_days: 14,
      settlements: [],
    };
    const defaultedNote = {
      ...arrearsNote,
      status: NoteStatus.DEFAULTED,
      servicing_status: NoteServicingStatus.DEFAULTED,
      default_marked_at: new Date("2026-09-10T00:00:00.000Z"),
    };
    const tx = {
      note: {
        findUnique: jest.fn().mockResolvedValue(arrearsNote),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(defaultedNote),
      },
      noteAdminAction: { create: jest.fn().mockResolvedValue({}) },
      noteEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    await new NoteService().markDefault("note-1", "Collections exhausted", actor);

    expect(tx.note.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "note-1",
          servicing_status: NoteServicingStatus.ARREARS,
          default_marked_at: null,
        },
      })
    );
    expect(tx.noteAdminAction.create).toHaveBeenCalledTimes(1);
    expect(tx.noteEvent.create).toHaveBeenCalledTimes(1);
    expect(noteLifecycle.notifyNoteDefaulted).toHaveBeenCalledTimes(1);
    expect(generateAndSendServicingLetter).toHaveBeenCalledTimes(1);
  });

  it("rejects a concurrent default transition without emitting duplicate side effects", async () => {
    const tx = {
      note: {
        findUnique: jest.fn().mockResolvedValue({
          id: "note-1",
          status: NoteStatus.ARREARS,
          servicing_status: NoteServicingStatus.ARREARS,
          default_marked_at: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    await expect(
      new NoteService().markDefault("note-1", "Collections exhausted", actor)
    ).rejects.toMatchObject({ code: "NOTE_DEFAULT_TRANSITION_CONFLICT" });
    expect(noteLifecycle.notifyNoteDefaulted).not.toHaveBeenCalled();
    expect(generateAndSendServicingLetter).not.toHaveBeenCalled();
  });
});
