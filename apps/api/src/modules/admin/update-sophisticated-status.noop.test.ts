const mockWriteOnboardingAuditLog = jest.fn();
jest.mock("../onboarding/audit/writer", () => ({
  writeOnboardingAuditLog: (...args: unknown[]) => mockWriteOnboardingAuditLog(...args),
}));

jest.mock("./repository", () => ({ AdminRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/repository", () => ({ RegTankRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/api-client", () => ({ RegTankAPIClient: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/service", () => ({ RegTankService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../organization/repository", () => ({ OrganizationRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../notification/service", () => ({ NotificationService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../products/repository", () => ({ ProductRepository: jest.fn().mockImplementation(() => ({})) }));

const mockInvestorFindUnique = jest.fn();
const mockInvestorUpdate = jest.fn();
jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
      update: (...args: unknown[]) => mockInvestorUpdate(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        investorOrganization: {
          update: (...args: unknown[]) => mockInvestorUpdate(...args),
        },
      }),
  },
}));

import { AdminService } from "./service";

describe("AdminService.updateSophisticatedStatus no-op", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not mutate or audit when value and reason are unchanged", async () => {
    mockInvestorFindUnique.mockResolvedValue({
      id: "org-1",
      name: "Acme",
      owner_user_id: "user-1",
      is_sophisticated_investor: true,
      sophisticated_investor_reason: "net-worth",
    });

    const service = new AdminService();
    const result = await service.updateSophisticatedStatus(
      { ip: "127.0.0.1" } as never,
      "org-1",
      true,
      "net-worth",
      "admin-1"
    );

    expect(result).toEqual({ success: true });
    expect(mockInvestorUpdate).not.toHaveBeenCalled();
    expect(mockWriteOnboardingAuditLog).not.toHaveBeenCalled();
  });

  it("audits when the value changes", async () => {
    mockInvestorFindUnique.mockResolvedValue({
      id: "org-1",
      name: "Acme",
      owner_user_id: "user-1",
      is_sophisticated_investor: false,
      sophisticated_investor_reason: null,
    });

    const service = new AdminService();
    await service.updateSophisticatedStatus({ ip: "127.0.0.1" } as never, "org-1", true, "net-worth", "admin-1");

    expect(mockInvestorUpdate).toHaveBeenCalled();
    expect(mockWriteOnboardingAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "INVESTOR_SOPHISTICATED_STATUS_UPDATED" }),
      expect.anything()
    );
  });
});
