import { ApplicationService } from "./service";

const mockFindFirst = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    noteProspectusReview: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
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

describe("Prospectus approval lock: Admin financial edits", () => {
  const service = new ApplicationService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows financial edits when there is no approved Prospectus review (Draft state)", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      (service as any).assertAdminFinancialEditsOpen("app-1", "SUBMITTED")
    ).resolves.toBeUndefined();
  });

  it("blocks financial edits when any Prospectus review is APPROVED (approved_at evidence)", async () => {
    mockFindFirst.mockResolvedValue({ approved_at: new Date("2026-07-19T00:00:00.000Z") });

    await expect((service as any).assertAdminFinancialEditsOpen("app-1", "SUBMITTED")).rejects.toMatchObject(
      { code: "FINANCIAL_SNAPSHOT_LOCKED", statusCode: 409 }
    );
  });

  it("unlocks when the approved Prospectus is returned to Draft (approved_at cleared)", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      (service as any).assertAdminFinancialEditsOpen("app-1", "SUBMITTED")
    ).resolves.toBeUndefined();
  });

  it("keeps financial edits locked when at least one Prospectus under the application is still approved (multi-Prospectus)", async () => {
    mockFindFirst.mockResolvedValue({ approved_at: new Date("2026-07-19T00:00:00.000Z") });

    await expect((service as any).assertAdminFinancialEditsOpen("app-1", "SUBMITTED")).rejects.toMatchObject(
      { code: "FINANCIAL_SNAPSHOT_LOCKED", statusCode: 409 }
    );
  });
});

