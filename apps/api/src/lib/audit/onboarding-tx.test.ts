const mockInvestorUpdate = jest.fn();
const mockCreateOnboardingLogRow = jest.fn();
const mockTransaction = jest.fn(async (fn: (tx: unknown) => unknown) =>
  fn({
    investorOrganization: { update: (...args: unknown[]) => mockInvestorUpdate(...args) },
    issuerOrganization: { update: jest.fn() },
  })
);

jest.mock("../prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock("./account-logs", () => ({
  createOnboardingLogRow: (...args: unknown[]) => mockCreateOnboardingLogRow(...args),
}));

import { persistOrganizationUpdateAndOnboardingLogs } from "./onboarding-tx";
import { UserRole } from "@prisma/client";

describe("persistOrganizationUpdateAndOnboardingLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvestorUpdate.mockResolvedValue({});
    mockCreateOnboardingLogRow.mockResolvedValue({ id: "log-1" });
  });

  it("runs the organization update and evidence insert on the same transaction client", async () => {
    await persistOrganizationUpdateAndOnboardingLogs({
      portalType: "investor",
      organizationId: "org-1",
      data: { onboarding_status: "REJECTED" },
      logs: [
        {
          userId: "user-1",
          role: UserRole.INVESTOR,
          eventType: "COD_REJECTED",
        },
      ],
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInvestorUpdate).toHaveBeenCalledTimes(1);
    expect(mockCreateOnboardingLogRow).toHaveBeenCalledTimes(1);
    const txClient = mockCreateOnboardingLogRow.mock.calls[0][1];
    expect(txClient).toEqual(
      expect.objectContaining({
        investorOrganization: expect.objectContaining({ update: expect.any(Function) }),
      })
    );
  });

  it("does not leave a committed organization write if the evidence insert fails", async () => {
    mockCreateOnboardingLogRow.mockRejectedValue(new Error("log insert failed"));
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      await fn({
        investorOrganization: { update: (...args: unknown[]) => mockInvestorUpdate(...args) },
        issuerOrganization: { update: jest.fn() },
      });
      throw new Error("log insert failed");
    });

    await expect(
      persistOrganizationUpdateAndOnboardingLogs({
        portalType: "investor",
        organizationId: "org-1",
        data: { onboarding_status: "REJECTED" },
        logs: [
          {
            userId: "user-1",
            role: UserRole.INVESTOR,
            eventType: "COD_REJECTED",
          },
        ],
      })
    ).rejects.toThrow("log insert failed");
  });
});
