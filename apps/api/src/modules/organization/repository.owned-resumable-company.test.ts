import { OrganizationType, OnboardingStatus } from "@prisma/client";

const mockFindManyInvestor = jest.fn();
const mockFindManyIssuer = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: { findMany: (...args: unknown[]) => mockFindManyInvestor(...args) },
    issuerOrganization: { findMany: (...args: unknown[]) => mockFindManyIssuer(...args) },
  },
}));

import { OrganizationRepository } from "./repository";

describe("OrganizationRepository findOwnedResumableCompanyByName", () => {
  const repo = new OrganizationRepository();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("matches owned incomplete investor companies by trimmed case-insensitive name", async () => {
    mockFindManyInvestor.mockResolvedValue([
      {
        id: "older",
        owner_user_id: "user_1",
        type: OrganizationType.COMPANY,
        name: "  ABC Sdn Bhd ",
        onboarding_status: OnboardingStatus.PENDING,
        created_at: new Date("2026-01-01"),
      },
      {
        id: "newer",
        owner_user_id: "user_1",
        type: OrganizationType.COMPANY,
        name: "abc sdn bhd",
        onboarding_status: OnboardingStatus.IN_PROGRESS,
        created_at: new Date("2026-02-01"),
      },
    ]);

    const match = await repo.findOwnedResumableCompanyByName("user_1", "investor", "abc sdn bhd");

    expect(mockFindManyInvestor).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          owner_user_id: "user_1",
          type: OrganizationType.COMPANY,
          onboarding_status: { in: [OnboardingStatus.PENDING, OnboardingStatus.IN_PROGRESS] },
        }),
        orderBy: { created_at: "asc" },
      })
    );
    expect(match?.id).toBe("older");
  });

  it("does not match a completed same-name investor company", async () => {
    mockFindManyInvestor.mockResolvedValue([]);

    const match = await repo.findOwnedResumableCompanyByName("user_1", "investor", "ABC Sdn Bhd");
    expect(match).toBeNull();
  });

  it("matches owned incomplete issuer companies independently of investor orgs", async () => {
    mockFindManyIssuer.mockResolvedValue([
      {
        id: "iss_1",
        owner_user_id: "user_1",
        type: OrganizationType.COMPANY,
        name: "ABC Sdn Bhd",
        onboarding_status: OnboardingStatus.IN_PROGRESS,
      },
    ]);

    const match = await repo.findOwnedResumableCompanyByName("user_1", "issuer", "abc sdn bhd");
    expect(mockFindManyInvestor).not.toHaveBeenCalled();
    expect(match?.id).toBe("iss_1");
  });
});
