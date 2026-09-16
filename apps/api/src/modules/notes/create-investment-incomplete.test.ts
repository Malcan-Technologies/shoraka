import { prisma } from "../../lib/prisma";
import { NoteService } from "./service";

const mockComputeOrgProfileCompleteness = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: { findFirst: jest.fn() },
  },
}));

jest.mock("../organization-profile/service", () => ({
  computeOrgProfileCompleteness: (...args: unknown[]) => mockComputeOrgProfileCompleteness(...args),
}));

describe("NoteService createInvestment profile completeness gate", () => {
  const actor = { userId: "inv-user-1", role: "INVESTOR", portal: "INVESTOR" };
  const noteId = "note-1";

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org-inv-1",
      deposit_received: true,
    });
    mockComputeOrgProfileCompleteness.mockResolvedValue({
      complete: false,
      percent: 90,
      missing: [
        {
          step: "identity",
          field: "dateOfBirth",
          label: "Date of Birth",
        },
      ],
    });
  });

  it("throws PROFILE_INCOMPLETE when investor DOB is missing", async () => {
    const service = new NoteService();

    await expect(
      service.createInvestment(
        noteId,
        { investorOrganizationId: "org-inv-1", amount: 2500, prospectusAcknowledged: true },
        actor
      )
    ).rejects.toMatchObject({ code: "PROFILE_INCOMPLETE" });
  });
});

