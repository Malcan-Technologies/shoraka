const mockRepo: Record<string, jest.Mock> = {};
const mockRunReport = jest.fn();

const metric = { amount: 100, count: 1 };

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => mockRepo),
}));
jest.mock("../regtank/repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../reports/service", () => ({
  runReport: (...args: unknown[]) => mockRunReport(...args),
}));
jest.mock("../../lib/prisma", () => ({ prisma: {} }));

import { AdminService } from "./service";

const PLATFORM_METHODS = [
  "getUserStats",
  "getCurrentPeriodStats",
  "getPreviousPeriodStats",
  "getSignupTrends",
  "getOrganizationStats",
  "getOrganizationPeriodCounts",
];
const OPERATIONS_METHODS = [
  "getOnboardingOperationsMetrics",
  "getApplicationDashboardMetrics",
  "getContractDashboardMetrics",
  "getNoteDashboardMetrics",
];
const FINANCE_METHODS = ["getBookMetrics", "listBookMetricsDailySnapshots"];

const NONE = { platform: false, operations: false, finance: false, reports: false };

function called(methods: string[]): boolean {
  return methods.some((name) => mockRepo[name]?.mock.calls.length);
}

describe("AdminService.getDashboardStats section filtering", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockRepo)) delete mockRepo[key];
    mockRunReport.mockReset();

    const userStats = { totalUsers: 10, investorsOnboarded: 4, issuersOnboarded: 2 };
    mockRepo.getUserStats = jest.fn().mockResolvedValue(userStats);
    mockRepo.getCurrentPeriodStats = jest.fn().mockResolvedValue(userStats);
    mockRepo.getPreviousPeriodStats = jest.fn().mockResolvedValue(userStats);
    mockRepo.getSignupTrends = jest.fn().mockResolvedValue([]);
    const portal = {
      total: 1,
      percentageChange: 0,
      personal: { total: 1, onboarded: 1, pending: 0 },
      company: { total: 0, onboarded: 0, pending: 0 },
    };
    mockRepo.getOrganizationStats = jest.fn().mockResolvedValue({ investor: portal, issuer: portal });
    mockRepo.getOrganizationPeriodCounts = jest.fn().mockResolvedValue({
      current: { investor: 1, issuer: 1 },
      previous: { investor: 1, issuer: 1 },
    });
    mockRepo.getOnboardingOperationsMetrics = jest.fn().mockResolvedValue({ pending: 1 });
    mockRepo.getApplicationDashboardMetrics = jest.fn().mockResolvedValue({ total: 1 });
    mockRepo.getContractDashboardMetrics = jest.fn().mockResolvedValue({ total: 1 });
    mockRepo.getNoteDashboardMetrics = jest.fn().mockResolvedValue({ total: 1 });
    mockRepo.getBookMetrics = jest.fn().mockResolvedValue({
      outstanding: metric,
      inFunding: metric,
      distressed: metric,
      arrears: metric,
      defaulted: metric,
      dueSoon: metric,
    });
    mockRepo.listBookMetricsDailySnapshots = jest.fn().mockResolvedValue([]);
    mockRunReport.mockResolvedValue({ portfolioAtRisk: { asOf: "2026-09-29", bookCount: 0 } });
  });

  it("returns no sections and runs no queries without any dashboard.* section permission", async () => {
    const result = await new AdminService().getDashboardStats(NONE);

    expect(result).toEqual({});
    expect(called([...PLATFORM_METHODS, ...OPERATIONS_METHODS, ...FINANCE_METHODS])).toBe(false);
    expect(mockRunReport).not.toHaveBeenCalled();
  });

  it("returns only platform data for dashboard.platform.view", async () => {
    const result = await new AdminService().getDashboardStats({ ...NONE, platform: true });

    expect(Object.keys(result).sort()).toEqual(["organizations", "signupTrends", "users"]);
    expect(called(OPERATIONS_METHODS)).toBe(false);
    expect(called(FINANCE_METHODS)).toBe(false);
    expect(mockRunReport).not.toHaveBeenCalled();
  });

  it("returns only operations data for dashboard.operations.view", async () => {
    const result = await new AdminService().getDashboardStats({ ...NONE, operations: true });

    expect(Object.keys(result).sort()).toEqual([
      "applicationMetrics",
      "contractMetrics",
      "noteMetrics",
      "onboardingOperations",
    ]);
    expect(called(PLATFORM_METHODS)).toBe(false);
    expect(called(FINANCE_METHODS)).toBe(false);
  });

  it("returns only book metrics for dashboard.finance.view", async () => {
    const result = await new AdminService().getDashboardStats({ ...NONE, finance: true });

    expect(Object.keys(result).sort()).toEqual(["bookMetricHistory", "bookMetrics"]);
    expect(called(PLATFORM_METHODS)).toBe(false);
    expect(called(OPERATIONS_METHODS)).toBe(false);
    expect(mockRunReport).not.toHaveBeenCalled();
  });

  it("returns only portfolio-at-risk for dashboard.reports.view", async () => {
    const result = await new AdminService().getDashboardStats({ ...NONE, reports: true });

    expect(Object.keys(result)).toEqual(["portfolioAtRisk"]);
    expect(mockRunReport).toHaveBeenCalledWith("ageing", {});
    expect(called([...PLATFORM_METHODS, ...OPERATIONS_METHODS, ...FINANCE_METHODS])).toBe(false);
  });

  it("returns every section when all permissions are held", async () => {
    const result = await new AdminService().getDashboardStats({
      platform: true,
      operations: true,
      finance: true,
      reports: true,
    });

    expect(Object.keys(result).sort()).toEqual([
      "applicationMetrics",
      "bookMetricHistory",
      "bookMetrics",
      "contractMetrics",
      "noteMetrics",
      "onboardingOperations",
      "organizations",
      "portfolioAtRisk",
      "signupTrends",
      "users",
    ]);
  });
});
