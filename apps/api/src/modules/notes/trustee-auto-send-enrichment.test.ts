jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(async () => ({ id: "note-1" })),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    platformFinanceSetting: {
      findUnique: jest.fn(),
    },
    withdrawalInstruction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: {
    findById: jest.fn(),
  },
}));

jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

import { WithdrawalType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { mapNoteDetail } from "./mapper";
import { noteRepository } from "./repository";
import { NoteService } from "./service";

describe("trustee auto-send response enrichment", () => {
  const service = new NoteService();

  beforeEach(() => {
    jest.clearAllMocks();
    (noteRepository.findById as jest.Mock).mockResolvedValue({ id: "note-1" });
    (prisma.withdrawalInstruction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: "wd-1",
      withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
    });
    jest
      .spyOn(service as unknown as { mapWithdrawal: (row: unknown) => unknown }, "mapWithdrawal")
      .mockImplementation((row) => ({ id: (row as { id: string }).id }));
  });

  it("enriches admin note detail when auto-send is enabled", async () => {
    (prisma.platformFinanceSetting.findUnique as jest.Mock).mockResolvedValue({
      trustee_letter_config: { autoSendTrusteeEmail: true },
    });

    await expect(service.getAdminNoteDetail("note-1")).resolves.toEqual({
      id: "note-1",
      trusteeAutoSendEmailEnabled: true,
    });
    expect(mapNoteDetail).toHaveBeenCalled();
    expect(prisma.platformFinanceSetting.findUnique).toHaveBeenCalledWith({
      where: { key: "DEFAULT" },
      select: { trustee_letter_config: true },
    });
  });

  it("enriches investor withdrawal detail when auto-send is disabled", async () => {
    (prisma.platformFinanceSetting.findUnique as jest.Mock).mockResolvedValue({
      trustee_letter_config: { autoSendTrusteeEmail: false },
    });

    await expect(service.getInvestorWithdrawal("wd-1")).resolves.toEqual({
      id: "wd-1",
      trusteeAutoSendEmailEnabled: false,
    });
  });

  it("defaults the flag to false when the settings row or config is missing", async () => {
    (prisma.platformFinanceSetting.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getAdminNoteDetail("note-1")).resolves.toMatchObject({
      trusteeAutoSendEmailEnabled: false,
    });

    (prisma.platformFinanceSetting.findUnique as jest.Mock).mockResolvedValue({
      trustee_letter_config: null,
    });

    await expect(service.getInvestorWithdrawal("wd-1")).resolves.toMatchObject({
      trusteeAutoSendEmailEnabled: false,
    });
  });
});
