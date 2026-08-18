import type { OrganizationResponse } from "@cashsouk/types";
import { sortRowsByColumn } from "@/shared/admin-list/table-sort";
import {
  organizationListDisplayName,
  organizationsSortValue,
} from "./organizations-table-sort";

function org(overrides: Partial<OrganizationResponse>): OrganizationResponse {
  return {
    id: "org-1",
    displayReference: "INV-1",
    portal: "investor",
    type: "COMPANY",
    name: "Acme",
    registrationNumber: "123",
    onboardingStatus: "COMPLETED",
    onboardedAt: "2026-01-01T00:00:00.000Z",
    owner: {
      userId: "user-1",
      email: "owner@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    },
    memberCount: 2,
    isSophisticatedInvestor: false,
    depositReceived: false,
    onboardingFeePaid: false,
    walletBalance: 100,
    investedAmount: 50,
    riskLevel: "Low Risk",
    riskScore: "12",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("organizations table sort", () => {
  it("uses company name or personal owner name", () => {
    expect(organizationListDisplayName(org({ type: "COMPANY", name: "  Zenith  " }))).toBe(
      "Zenith"
    );
    expect(
      organizationListDisplayName(
        org({ type: "PERSONAL", name: null, owner: {
          userId: "user-1",
          email: "owner@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
        } })
      )
    ).toBe("Ada Lovelace");
  });

  it("sorts organization names A-Z and wallets high to low", () => {
    const rows = [
      org({ id: "z", name: "Zenith", walletBalance: 10, memberCount: 8 }),
      org({ id: "a", name: "Alpha", walletBalance: 90, memberCount: 1 }),
      org({ id: "m", name: "Mid", walletBalance: null, memberCount: 4 }),
    ];

    const byName = sortRowsByColumn(
      rows,
      { column: "organization", direction: "asc" },
      organizationsSortValue
    );
    expect(byName.map((row) => row.id)).toEqual(["a", "m", "z"]);

    const byWallet = sortRowsByColumn(
      rows,
      { column: "wallet", direction: "desc" },
      organizationsSortValue
    );
    expect(byWallet.map((row) => row.id)).toEqual(["a", "z", "m"]);

    const byMembers = sortRowsByColumn(
      rows,
      { column: "members", direction: "desc" },
      organizationsSortValue
    );
    expect(byMembers.map((row) => row.id)).toEqual(["z", "m", "a"]);
  });
});
