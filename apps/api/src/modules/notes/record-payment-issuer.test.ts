/**
 * Issuer partial on-behalf payments share admin receipt caps; coverage for review gate.
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
  const actual = jest.requireActual<typeof import("../notification/note-lifecycle-notifications")>(
    "../notification/note-lifecycle-notifications"
  );
  return {
    ...actual,
    notifyNotePaymentReceived: jest.fn().mockResolvedValue(undefined),
  };
});

import {
  NoteFundingStatus,
  NotePaymentSource,
  NotePaymentStatus,
  NoteServicingStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import * as noteLifecycle from "../notification/note-lifecycle-notifications";
import { noteRepository } from "./repository";
import { NoteService } from "./service";

describe("NoteService recordPayment issuer on behalf", () => {
  const issuerActor = { userId: "issuer-1", role: "ISSUER", portal: "ISSUER" };

  const baseNote = {
    id: "note-1",
    funding_status: NoteFundingStatus.FUNDED,
    servicing_status: NoteServicingStatus.CURRENT,
    payments: [] as Array<{
      status: NotePaymentStatus;
      receipt_amount: Prisma.Decimal;
    }>,
    settlements: [] as Array<unknown>,
    invoice_snapshot: null,
    requested_amount: new Prisma.Decimal("1000"),
    title: "N",
    note_reference: null,
    grace_period_days: 0,
    tawidh_rate_cap_percent: new Prisma.Decimal(0),
    gharamah_rate_cap_percent: new Prisma.Decimal(0),
    payment_schedules: [] as Array<unknown>,
    maturity_date: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts partial issuer submission as PENDING and skips immediate payment notification", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({ ...baseNote });

    const tx = {
      notePayment: {
        create: jest.fn().mockResolvedValue({
          id: "pay-1",
          note_id: "note-1",
          receipt_amount: new Prisma.Decimal("400"),
          source: NotePaymentSource.ISSUER_ON_BEHALF,
          reference: null as string | null,
        }),
      },
      noteEvent: { create: jest.fn().mockResolvedValue({}) },
      note: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseNote }),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    const service = new NoteService();
    await service.recordPayment(
      "note-1",
      {
        source: NotePaymentSource.ISSUER_ON_BEHALF,
        receiptAmount: 400,
        receiptDate: new Date().toISOString(),
      },
      issuerActor
    );

    expect(tx.notePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotePaymentStatus.PENDING,
          receipt_amount: expect.any(Object),
        }),
      })
    );
    expect(noteLifecycle.notifyNotePaymentReceived).not.toHaveBeenCalled();
  });

  it("ignores stale pending late-fee allowance fields on receipt recording", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({ ...baseNote });

    const tx = {
      notePayment: {
        create: jest.fn().mockResolvedValue({
          id: "pay-1",
          note_id: "note-1",
          receipt_amount: new Prisma.Decimal("100"),
          source: NotePaymentSource.ISSUER_ON_BEHALF,
          reference: null as string | null,
        }),
      },
      noteEvent: { create: jest.fn().mockResolvedValue({}) },
      note: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseNote }),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    const service = new NoteService();
    await service.recordPayment(
      "note-1",
      {
        source: NotePaymentSource.ISSUER_ON_BEHALF,
        receiptAmount: 100,
        receiptDate: new Date().toISOString(),
      },
      issuerActor
    );

    expect(tx.noteEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.not.objectContaining({
            pendingTawidhAmount: expect.anything(),
            pendingGharamahAmount: expect.anything(),
          }),
        }),
      })
    );
  });

  it("rejects issuer partial when aggregate would exceed settlement cap", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...baseNote,
      payments: [
        {
          status: NotePaymentStatus.RECEIVED,
          receipt_amount: new Prisma.Decimal("700"),
        },
      ],
    });
    const service = new NoteService();
    await expect(
      service.recordPayment(
        "note-1",
        {
          source: NotePaymentSource.ISSUER_ON_BEHALF,
          receiptAmount: 400,
          receiptDate: new Date().toISOString(),
        },
        issuerActor
      )
    ).rejects.toEqual(
      expect.objectContaining({
        code: "SETTLEMENT_RECEIPT_LIMIT_EXCEEDED",
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
