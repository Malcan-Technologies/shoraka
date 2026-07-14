import { mergeRoleLabels } from "./aml-fetcher";
import {
  corporatePersonIdentitiesMatch,
  resolveCorporatePersonMergeKey,
} from "./helpers/corporate-person-merge-key";

const mockGetCorporateOnboardingDetails = jest.fn();
const mockGetEntityOnboardingDetails = jest.fn();
const mockQueryKYCStatus = jest.fn();
const mockQueryKYBStatus = jest.fn();

jest.mock("./api-client", () => ({
  getRegTankAPIClient: () => ({
    getCorporateOnboardingDetails: (...args: unknown[]) => mockGetCorporateOnboardingDetails(...args),
    getEntityOnboardingDetails: (...args: unknown[]) => mockGetEntityOnboardingDetails(...args),
    queryKYCStatus: (...args: unknown[]) => mockQueryKYCStatus(...args),
    queryKYBStatus: (...args: unknown[]) => mockQueryKYBStatus(...args),
  }),
}));

jest.mock("./aml-identity-repository", () => ({
  AmlIdentityRepository: jest.fn().mockImplementation(() => ({
    upsertFromKyc: jest.fn(),
  })),
}));

const mockInvestorOrgFindUnique = jest.fn();
const mockInvestorOrgUpdate = jest.fn(() => Promise.resolve());
jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorOrgFindUnique(...args),
      update: (...args: unknown[]) => mockInvestorOrgUpdate(...args),
    },
    issuerOrganization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { AMLFetcherService } from "./aml-fetcher";

describe("mergeRoleLabels (AMLFetcher director/shareholder role merge)", () => {
  it("merges Director with Shareholder (60%) once", () => {
    expect(mergeRoleLabels("Director", "Shareholder (60%)")).toBe("Director, Shareholder (60%)");
  });

  it("does not duplicate Shareholder (60%) when already present", () => {
    expect(mergeRoleLabels("Director, Shareholder (60%)", "Shareholder (60%)")).toBe(
      "Director, Shareholder (60%)"
    );
  });

  it("is idempotent across repeated refresh merges", () => {
    let role = "Director";
    role = mergeRoleLabels(role, "Shareholder (60%)");
    role = mergeRoleLabels(role, "Shareholder (60%)");
    role = mergeRoleLabels(role, "Shareholder (60%)");
    expect(role).toBe("Director, Shareholder (60%)");
  });

  it("preserves different legitimate labels", () => {
    expect(mergeRoleLabels("Director", "Shareholder (10%)")).toBe("Director, Shareholder (10%)");
    expect(mergeRoleLabels("Director, Shareholder (10%)", "Shareholder (60%)")).toBe(
      "Director, Shareholder (10%), Shareholder (60%)"
    );
  });

  it("ignores empty or undefined role values without adding commas", () => {
    expect(mergeRoleLabels("Director", "")).toBe("Director");
    expect(mergeRoleLabels("Director", undefined)).toBe("Director");
    expect(mergeRoleLabels("", "Shareholder (60%)")).toBe("Shareholder (60%)");
    expect(mergeRoleLabels(null, null)).toBe("");
    expect(mergeRoleLabels("Director, ", " , Shareholder (60%)")).toBe(
      "Director, Shareholder (60%)"
    );
  });

  it("only affects the role string — merge input objects keep KYC/AML fields unchanged", () => {
    const existing = {
      eodRequestId: "EOD04651",
      name: "Lucas Yi Jin",
      email: "lucas@example.com",
      role: "Director, Shareholder (60%)",
      kycStatus: "APPROVED",
      kycId: "KYC00073",
      governmentIdNumber: "900101101111",
      lastUpdated: "2026-07-14T00:00:00.000Z",
    };
    const nextRole = mergeRoleLabels(existing.role, "Shareholder (60%)");
    const merged = { ...existing, role: nextRole };

    expect(merged.role).toBe("Director, Shareholder (60%)");
    expect(merged.kycStatus).toBe("APPROVED");
    expect(merged.kycId).toBe("KYC00073");
    expect(merged.governmentIdNumber).toBe("900101101111");
    expect(merged.eodRequestId).toBe("EOD04651");
    expect(merged.lastUpdated).toBe(existing.lastUpdated);
  });
});

describe("AMLFetcher identity matching + KYC gate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not call /v3/kyc/query when expired EOD has no kycId", async () => {
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD06284", status: "EXPIRED" },
          corporateUserRequestInfo: {
            fullName: "Lim Tze Yang",
            email: "shared@example.com",
            formContent: {
              content: [
                { fieldName: "First Name", fieldValue: "Lim" },
                { fieldName: "Last Name", fieldValue: "Tze Yang" },
                { fieldName: "Email Address", fieldValue: "shared@example.com" },
                { fieldName: "Designation", fieldValue: "Director" },
                { fieldName: "Government ID Number", fieldValue: "900101-10-1111" },
              ],
            },
          },
        },
      ],
      corpIndvShareholders: [],
      corpBizShareholders: [],
    });
    mockGetEntityOnboardingDetails.mockResolvedValue({
      corporateIndividualRequest: { requestId: "EOD06284", status: "EXPIRED" },
    });
    mockInvestorOrgFindUnique.mockResolvedValue({
      director_kyc_status: { directors: [] },
      director_aml_status: { directors: [] },
    });

    const fetcher = new AMLFetcherService();
    const statuses = await fetcher.fetchIndividualDirectorAMLStatuses(
      "COD05079",
      "org-2",
      "investor"
    );

    expect(statuses).toEqual([]);
    expect(mockGetCorporateOnboardingDetails).toHaveBeenCalledWith("COD05079");
    expect(mockGetEntityOnboardingDetails).toHaveBeenCalledWith("EOD06284");
    expect(mockQueryKYCStatus).not.toHaveBeenCalled();
    expect(mockQueryKYBStatus).not.toHaveBeenCalled();
  });

  it("keeps same-email directors separate by government ID in identity helpers used by AMLFetcher", () => {
    const limKey = resolveCorporatePersonMergeKey({
      governmentIdNumber: "900101-10-1111",
      name: "Lim Tze Yang",
      eodRequestId: "EOD06284",
    });
    const ahmadKey = resolveCorporatePersonMergeKey({
      governmentIdNumber: "800202-10-2222",
      name: "Ahmad Shahril",
      eodRequestId: "EOD06286",
    });
    expect(limKey).not.toBe(ahmadKey);
    expect(
      corporatePersonIdentitiesMatch(
        { governmentIdNumber: "900101-10-1111", name: "Lim Tze Yang", eodRequestId: "EOD06284" },
        { governmentIdNumber: "800202-10-2222", name: "Ahmad Shahril", eodRequestId: "EOD06286" }
      )
    ).toBe(false);
  });
});
