const mockDebit = jest.fn();
const mockNotifyCommitted = jest.fn();
const mockCreateNoteEventRow = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: { findFirst: jest.fn() },
    note: { findUnique: jest.fn() },
    noteProspectusPublication: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("./investor-balance", () => {
  const actual = jest.requireActual("./investor-balance") as Record<string, unknown>;
  return {
    ...actual,
    debitInvestorBalanceForCommit: (...args: unknown[]) => mockDebit(...args),
  };
});

jest.mock("../notification/investment-notifications", () => ({
  notifyInvestmentCommitted: (...args: unknown[]) => mockNotifyCommitted(...args),
}));

jest.mock("../legal-documents/acceptance-service", () => ({
  legalDocumentAcceptanceService: { assertNoPendingReacceptance: jest.fn() },
}));

jest.mock("../../lib/audit", () => {
  const actual = jest.requireActual("../../lib/audit") as Record<string, unknown>;
  return {
    ...actual,
    createNoteEventRow: (...args: unknown[]) => mockCreateNoteEventRow(...args),
  };
});

jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapMarketplaceNoteDetail: jest.fn(() => ({ id: "note-1" })),
}));

import { NoteFundingStatus, NoteListingStatus, NoteStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NoteService } from "./service";

describe("NoteService createInvestment notification", () => {
  const actor = { userId: "inv-user-1", role: "INVESTOR", portal: "INVESTOR" };
  const noteId = "note-1";

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org-inv-1",
      deposit_received: true,
    });
    (prisma.note.findUnique as jest.Mock).mockResolvedValue({
      status: NoteStatus.PUBLISHED,
      funding_status: NoteFundingStatus.OPEN,
      listing_status: NoteListingStatus.PUBLISHED,
      target_amount: 100_000,
      funded_amount: 10_000,
      prospectus_review: { status: "APPROVED", approved_publication_id: "pub-1", content_version: 1 },
    });
    (prisma.noteProspectusPublication.findFirst as jest.Mock).mockResolvedValue({
      id: "pub-1",
      content_version: 1,
      published_at: new Date(),
    });
  });

  it("sends one notification to the committing investor after the Activity event, without a second event", async () => {
    const noteRow = {
      id: noteId,
      title: "Invoice Note",
      note_reference: "N-1",
      funded_amount: 12_500,
      target_amount: 100_000,
      status: NoteStatus.PUBLISHED,
      funding_status: NoteFundingStatus.OPEN,
      listing_status: NoteListingStatus.PUBLISHED,
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        note: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(noteRow),
        },
        noteInvestment: {
          create: jest.fn().mockResolvedValue({ id: "ni-1" }),
        },
      })
    );
    mockDebit.mockResolvedValue(undefined);
    mockCreateNoteEventRow.mockResolvedValue(undefined);
    mockNotifyCommitted.mockResolvedValue(undefined);

    const service = new NoteService();
    await service.createInvestment(
      noteId,
      { investorOrganizationId: "org-inv-1", amount: 2500, prospectusAcknowledged: true },
      actor
    );

    expect(mockCreateNoteEventRow).toHaveBeenCalledTimes(1);
    expect(mockCreateNoteEventRow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "INVESTMENT_COMMITTED" })
    );
    expect(mockNotifyCommitted).toHaveBeenCalledTimes(1);
    expect(mockNotifyCommitted).toHaveBeenCalledWith(
      expect.objectContaining({
        investmentId: "ni-1",
        recipientUserId: "inv-user-1",
        amount: 2500,
        noteId,
        noteTitle: "Invoice Note",
      })
    );
  });
});
