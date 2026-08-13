import { OnboardingStatus, UserRole } from "@prisma/client";
import { AuthService } from "./service";

const mockUserFindUnique = jest.fn();
const mockInvestorFindMany = jest.fn();
const mockIssuerFindMany = jest.fn();
const mockRegTankFindMany = jest.fn();
const mockOnboardingLogFind = jest.fn();
const mockOnboardingAuditFind = jest.fn();

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    investorOrganization: { findMany: (...args: unknown[]) => mockInvestorFindMany(...args) },
    issuerOrganization: { findMany: (...args: unknown[]) => mockIssuerFindMany(...args) },
    regTankOnboarding: { findMany: (...args: unknown[]) => mockRegTankFindMany(...args) },
    onboardingLog: {
      findMany: (...args: unknown[]) => mockOnboardingLogFind(...args),
      findFirst: (...args: unknown[]) => mockOnboardingLogFind(...args),
      findUnique: (...args: unknown[]) => mockOnboardingLogFind(...args),
    },
    onboardingAuditLog: {
      findMany: (...args: unknown[]) => mockOnboardingAuditFind(...args),
      findFirst: (...args: unknown[]) => mockOnboardingAuditFind(...args),
      findUnique: (...args: unknown[]) => mockOnboardingAuditFind(...args),
    },
  },
}));

jest.mock("./repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    findActiveSession: jest.fn().mockResolvedValue({ active_role: UserRole.INVESTOR }),
    revokeSession: jest.fn(),
  })),
}));

jest.mock("./audit/writer", () => ({
  writeAccessAuditLogBestEffort: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../config/env", () => ({
  getEnv: jest.fn().mockResolvedValue({ FRONTEND_URL: "http://localhost:3000" }),
}));

const req = { headers: {} } as never;

describe("AuthService.cancelOnboarding", () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService();
    mockUserFindUnique.mockResolvedValue({
      user_id: "user-1",
      roles: [UserRole.INVESTOR],
    });
    mockInvestorFindMany.mockResolvedValue([]);
    mockIssuerFindMany.mockResolvedValue([]);
    mockRegTankFindMany.mockResolvedValue([]);
  });

  it("never-started user returns cancelled false without audit reads", async () => {
    const result = await service.cancelOnboarding(req, "user-1", UserRole.INVESTOR);
    expect(result).toEqual({ success: true, cancelled: false });
    expect(mockOnboardingLogFind).not.toHaveBeenCalled();
    expect(mockOnboardingAuditFind).not.toHaveBeenCalled();
  });

  it("COMPLETED org without historical audit rows returns cancelled false", async () => {
    mockInvestorFindMany.mockResolvedValue([
      { id: "org-1", onboarding_status: OnboardingStatus.COMPLETED, onboarded_at: new Date() },
    ]);
    const result = await service.cancelOnboarding(req, "user-1", UserRole.INVESTOR);
    expect(result.cancelled).toBe(false);
    expect(mockOnboardingLogFind).not.toHaveBeenCalled();
    expect(mockOnboardingAuditFind).not.toHaveBeenCalled();
  });

  it("incomplete org without historical audit rows returns cancelled true", async () => {
    mockInvestorFindMany.mockResolvedValue([
      { id: "org-1", onboarding_status: OnboardingStatus.IN_PROGRESS, onboarded_at: null },
    ]);
    const result = await service.cancelOnboarding(req, "user-1", UserRole.INVESTOR);
    expect(result.cancelled).toBe(true);
    expect(mockOnboardingLogFind).not.toHaveBeenCalled();
    expect(mockOnboardingAuditFind).not.toHaveBeenCalled();
  });

  it("PENDING org with matching RegTank session returns cancelled true", async () => {
    mockInvestorFindMany.mockResolvedValue([
      { id: "org-1", onboarding_status: OnboardingStatus.PENDING, onboarded_at: null },
    ]);
    mockRegTankFindMany.mockResolvedValue([{ investor_organization_id: "org-1", issuer_organization_id: null }]);
    const result = await service.cancelOnboarding(req, "user-1", UserRole.INVESTOR);
    expect(result.cancelled).toBe(true);
  });

  it("PENDING org without a provider session returns cancelled false", async () => {
    mockInvestorFindMany.mockResolvedValue([
      { id: "org-1", onboarding_status: OnboardingStatus.PENDING, onboarded_at: null },
    ]);
    const result = await service.cancelOnboarding(req, "user-1", UserRole.INVESTOR);
    expect(result.cancelled).toBe(false);
  });

  it("logout continues when cancelOnboarding throws", async () => {
    mockUserFindUnique.mockRejectedValueOnce(new Error("db down"));
    const logout = await service.logout(req, "user-1", UserRole.INVESTOR);
    expect(logout.success).toBe(true);
  });
});
