/**
 * markWithdrawalSubmitted must fire the already-registered withdrawal_submitted_to_trustee
 * notification at the existing WITHDRAWAL_SUBMITTED_TO_TRUSTEE audit moment, targeting the
 * issuer organisation only (never investor withdrawals), without altering the audit event
 * timing or trustee workflow itself.
 */
jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapWithdrawalInstruction: jest.fn((withdrawal: { id: string }) => ({ id: withdrawal.id })),
}));

jest.mock("../../lib/audit", () => ({
  ...jest.requireActual<typeof import("../../lib/audit")>("../../lib/audit"),
  createNoteEventRow: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../notification/note-lifecycle-notifications", () => ({
  ...jest.requireActual<typeof import("../notification/note-lifecycle-notifications")>(
    "../notification/note-lifecycle-notifications"
  ),
  notifyWithdrawalSubmittedToTrustee: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    withdrawalInstruction: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { WithdrawalStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createNoteEventRow } from "../../lib/audit";
import * as noteLifecycle from "../notification/note-lifecycle-notifications";
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
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
    });

    const service = new NoteService();
    await service.markWithdrawalSubmitted("wd-1", actor);

    expect(createNoteEventRow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        noteId: "note-1",
        eventType: "WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
        metadata: { withdrawalId: "wd-1" },
      })
    );
    expect(noteLifecycle.notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledTimes(1);
    expect(noteLifecycle.notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledWith({
      notificationService: expect.any(Object),
      withdrawalId: "wd-1",
      issuerOrganizationId: "iss-1",
    });
  });

  it("does not notify for an investor withdrawal (no issuer_organization_id)", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "wd-2",
      status: WithdrawalStatus.LETTER_GENERATED,
      letter_s3_key: "key.pdf",
    });
    mockTransactionReturning({
      id: "wd-2",
      note_id: "note-2",
      issuer_organization_id: null,
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
    });

    const service = new NoteService();
    await service.markWithdrawalSubmitted("wd-2", actor);

    expect(createNoteEventRow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ eventType: "WITHDRAWAL_SUBMITTED_TO_TRUSTEE" })
    );
    expect(noteLifecycle.notifyWithdrawalSubmittedToTrustee).not.toHaveBeenCalled();
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
      status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
    });

    const service = new NoteService();
    await service.markWithdrawalSubmitted("wd-3", actor);

    expect(createNoteEventRow).not.toHaveBeenCalled();
    expect(noteLifecycle.notifyWithdrawalSubmittedToTrustee).toHaveBeenCalledWith({
      notificationService: expect.any(Object),
      withdrawalId: "wd-3",
      issuerOrganizationId: "iss-3",
    });
  });
});
