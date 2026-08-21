const mockFindById = jest.fn();
const mockFailFunding = jest.fn();
const mockRefreshForNote = jest.fn();

jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: {
    findById: (...args: unknown[]) => mockFindById(...args),
  },
}));

jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(() => ({ id: "note-1", status: "FAILED_FUNDING" })),
  mapNoteListItem: jest.fn(() => ({ id: "note-1" })),
}));

jest.mock("./investor-balance", () => ({
  creditInvestorBalance: jest.fn(),
}));

jest.mock("../notification/note-lifecycle-notifications", () => {
  const actual = jest.requireActual<typeof import("../notification/note-lifecycle-notifications")>(
    "../notification/note-lifecycle-notifications"
  );
  return {
    ...actual,
    notifyNoteFundingFailed: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    issuerOrganization: { findUnique: jest.fn() },
    note: { findUnique: jest.fn() },
  },
}));

jest.mock("../../lib/refresh-contract-facility", () => ({
  lockContractRow: jest.fn(),
  refreshContractFacilityForNote: (...args: unknown[]) => mockRefreshForNote(...args),
}));

jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

import { NoteFundingStatus, NoteStatus } from "@prisma/client";
import { NoteService } from "./service";
import { prisma } from "../../lib/prisma";

describe("NoteService capacity", () => {
  const service = new NoteService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes a zero-funded close to fail funding without starting closeFunding's transaction", async () => {
    mockFindById.mockResolvedValue({
      id: "note-1",
      status: NoteStatus.PUBLISHED,
      funding_status: NoteFundingStatus.OPEN,
      funded_amount: 0,
      target_amount: 100_000,
      minimum_funding_percent: 0,
      source_contract_id: "contract-1",
    });
    mockFailFunding.mockResolvedValue({ id: "note-1", status: "FAILED_FUNDING" });
    const failSpy = jest.spyOn(service, "failFunding").mockImplementation(mockFailFunding);

    const actor = { userId: "admin-1", role: "ADMIN" as const, portal: "ADMIN" as const };
    const result = await service.closeFunding("note-1", actor);

    expect(mockFailFunding).toHaveBeenCalledWith("note-1", actor, { forceZeroFunded: true });
    expect(result).toEqual({ id: "note-1", status: "FAILED_FUNDING" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    failSpy.mockRestore();
  });

  it("marketplace failure refreshes occupancy after releasing commitments", async () => {
    mockFindById.mockResolvedValue({
      id: "note-1",
      status: NoteStatus.PUBLISHED,
      funding_status: NoteFundingStatus.OPEN,
      funded_amount: 10_000,
      target_amount: 100_000,
      minimum_funding_percent: 80,
      source_contract_id: "contract-1",
      issuer_organization_id: "org-1",
    });
    const failedNote = {
      id: "note-1",
      status: "FAILED_FUNDING",
      source_contract_id: "contract-1",
      issuer_organization_id: "org-1",
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          noteInvestment: {
            findMany: jest.fn().mockResolvedValue([]),
            updateMany: jest.fn(),
          },
          note: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(failedNote),
          },
          noteAdminAction: { create: jest.fn() },
          noteEvent: { create: jest.fn() },
        })
    );
    (service as unknown as { logAdminAction: jest.Mock }).logAdminAction = jest.fn();
    (service as unknown as { logEvent: jest.Mock }).logEvent = jest.fn();

    const actor = { userId: "admin-1", role: "ADMIN" as const, portal: "ADMIN" as const };
    await service.failFunding("note-1", actor);

    expect(mockRefreshForNote).toHaveBeenCalledWith(
      failedNote,
      expect.anything(),
      expect.objectContaining({ reason: "FUNDING_FAILED" }),
      expect.objectContaining({ assertProposed: true, skipLock: true })
    );
  });
});
