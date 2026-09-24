import { ApplicationService } from "./service";

const mockFindUnique = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    applicationReview: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    noteProspectusReview: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("./repository", () => ({
  ApplicationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../contracts/repository", () => ({
  ContractRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

describe("Financial review section lock", () => {
  const service = new ApplicationService();
  const { prisma } = jest.requireMock("../../lib/prisma") as {
    prisma: { noteProspectusReview: { findFirst: jest.Mock } };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows edits when the Financial section is open", async () => {
    mockFindUnique.mockResolvedValue({ status: "PENDING" });
    await expect((service as any).assertAdminFinancialEditsOpen("app-1")).resolves.toBeUndefined();
    expect(prisma.noteProspectusReview.findFirst).not.toHaveBeenCalled();
  });

  it("allows edits when no Financial review row exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect((service as any).assertAdminFinancialEditsOpen("app-1")).resolves.toBeUndefined();
  });

  it("locks edits when the Financial section is approved", async () => {
    mockFindUnique.mockResolvedValue({ status: "APPROVED" });
    await expect((service as any).assertAdminFinancialEditsOpen("app-1")).rejects.toMatchObject({
      code: "FINANCIAL_REVIEW_LOCKED",
      statusCode: 409,
    });
  });

  it("unlocks when a financial amendment reopens the section", async () => {
    mockFindUnique.mockResolvedValue({ status: "AMENDMENT_REQUESTED" });
    await expect((service as any).assertAdminFinancialEditsOpen("app-1")).resolves.toBeUndefined();
  });

  it("does not consult Prospectus approval", async () => {
    mockFindUnique.mockResolvedValue({ status: "PENDING" });
    await (service as any).assertAdminFinancialEditsOpen("app-1");
    expect(prisma.noteProspectusReview.findFirst).not.toHaveBeenCalled();
  });
});
