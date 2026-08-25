/**
 * markWithdrawalSubmitted fires notifyWithdrawalSubmittedToTrustee (main helper in
 * withdrawal-notifications) at the WITHDRAWAL_SUBMITTED_TO_TRUSTEE audit moment.
 * Recipient routing (investor vs issuer org) lives in that helper, not here.
 */
jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapWithdrawalInstruction: jest.fn((withdrawal: { id: string }) => ({ id: withdrawal.id })),
}));

jest.mock("../../lib/audit", () => ({
  ...jest.requireActual<typeof import("../../lib/audit")>("../../lib/audit"),
  createNoteEventRow: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../notification/withdrawal-notifications", () => ({
  notifyWithdrawalSubmittedToTrustee: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    withdrawalInstruction: {
      findUnique: jest.fn(),
    },
    platformFinanceSetting: {
      upsert: jest.fn().mockResolvedValue({
        id: "pfs-1",
        key: "DEFAULT",
        trustee_letter_config: null,
        updated_at: new Date("2026-08-26T00:00:00.000Z"),
      }),
    },
    $transaction: jest.fn(),
  },
}));

import { WithdrawalStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createNoteEventRow } from "../../lib/audit";
import { notifyWithdrawalSubmittedToTrustee } from "../notification/withdrawal-notifications";
import { NoteService } from "./service";

describe("NoteService.markWithdrawalSubmitted — trustee notification wiring", () => {
  const actor = { userId: "admin-1", role: "ADMIN", portal: "ADMIN" };

  function mockTransactionReturning(finalRow: Record<string, unknown>) {
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        withdrawalInstruction: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(finalRow),
        },
      })
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fires notifyWithdrawalSubmittedToTrustee for an issuer disbursement withdrawal", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "wd-1",
      status: WithdrawalStatus.LETTER_GENERATED,
      letter_s3_key: "key.pdf",
    });
    mockTransactionReturning({
      id: "wd-1",
      note_id: "note-1",
      issuer_organization_id: "iss-1",
      display_reference: "WDL-ARF-202608-A1Z",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
    });

    const service = new NoteService();
    await service.markWithdrawalSubmitted("wd-1", actor);

    expect(createNoteEventRow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        noteId: "note-1",
        eventType: "WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
        metadata: { withdrawalId: "wd-1", withdrawalReference: "WDL-ARF-202608-A1Z" },
      })
    );
    expect(notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledTimes(1);
    expect(notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledWith({
      notificationService: expect.any(Object),
      withdrawal: expect.objectContaining({
        id: "wd-1",
        note_id: "note-1",
        issuer_organization_id: "iss-1",
        display_reference: "WDL-ARF-202608-A1Z",
      }),
    });
  });

  it("still notifies for an investor withdrawal so the helper can route to the investor org", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "wd-2",
      status: WithdrawalStatus.LETTER_GENERATED,
      letter_s3_key: "key.pdf",
    });
    mockTransactionReturning({
      id: "wd-2",
      note_id: "note-2",
      issuer_organization_id: null,
      display_reference: "WDL-202608-X7A",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
    });

    const service = new NoteService();
    await service.markWithdrawalSubmitted("wd-2", actor);

    expect(createNoteEventRow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: "WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
        metadata: { withdrawalId: "wd-2", withdrawalReference: "WDL-202608-X7A" },
      })
    );
    expect(notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledTimes(1);
    expect(notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledWith({
      notificationService: expect.any(Object),
      withdrawal: expect.objectContaining({
        id: "wd-2",
        issuer_organization_id: null,
        display_reference: "WDL-202608-X7A",
      }),
    });
  });

  it("still writes the audit event and status transition when the withdrawal has no linked note", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "wd-3",
      status: WithdrawalStatus.LETTER_GENERATED,
      letter_s3_key: "key.pdf",
    });
    mockTransactionReturning({
      id: "wd-3",
      note_id: null,
      issuer_organization_id: "iss-3",
      display_reference: "WDL-202608-B2C",
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
    });

    const service = new NoteService();
    await service.markWithdrawalSubmitted("wd-3", actor);

    expect(createNoteEventRow).not.toHaveBeenCalled();
    expect(notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledWith({
      notificationService: expect.any(Object),
      withdrawal: expect.objectContaining({
        id: "wd-3",
        note_id: null,
        issuer_organization_id: "iss-3",
        display_reference: "WDL-202608-B2C",
      }),
    });
  });
});
