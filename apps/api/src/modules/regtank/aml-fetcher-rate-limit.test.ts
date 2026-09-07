import { AppError } from "../../lib/http/error-handler";
import { REGTANK_RATE_LIMITED_CODE, REGTANK_RATE_LIMITED_MESSAGE } from "./helpers/regtank-rate-limit";
import { AMLFetcherService } from "./aml-fetcher";

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

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    issuerOrganization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma";

function rateLimit(): AppError {
  return new AppError(429, REGTANK_RATE_LIMITED_CODE, REGTANK_RATE_LIMITED_MESSAGE, {
    retryAfterSeconds: 15,
  });
}

describe("AMLFetcher 429 handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      director_kyc_status: { directors: [] },
      director_aml_status: { directors: [], businessShareholders: [] },
      corporate_entities: {
        corporateShareholders: [
          { corporateOnboardingRequest: { requestId: "COD-CHILD" } },
        ],
      },
    });
  });

  it("does not retry KYB when the provider returns 429", async () => {
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [],
      corpIndvShareholders: [],
      corpBizShareholders: [
        {
          name: "Child Sdn Bhd",
          corporateOnboardingRequest: { requestId: "COD-CHILD" },
        },
      ],
    });
    mockGetCorporateOnboardingDetails.mockImplementation(async (id: string) => {
      if (id === "COD-PARENT") {
        return {
          corpIndvDirectors: [],
          corpIndvShareholders: [],
          corpBizShareholders: [
            { name: "Child Sdn Bhd", corporateOnboardingRequest: { requestId: "COD-CHILD" } },
          ],
        };
      }
      return {
        kybRequestDto: { kybId: "KYB1" },
      };
    });
    mockQueryKYBStatus.mockRejectedValue(rateLimit());

    const fetcher = new AMLFetcherService();
    await expect(
      fetcher.fetchBusinessShareholderAMLStatuses("COD-PARENT", "org-1", "investor")
    ).rejects.toBeInstanceOf(AppError);

    expect(mockQueryKYBStatus).toHaveBeenCalledTimes(1);
  });

  it("KYC 429 stops remaining director fetches in that session", async () => {
    mockGetCorporateOnboardingDetails.mockResolvedValue({
      corpIndvDirectors: [
        {
          corporateIndividualRequest: { requestId: "EOD1", status: "APPROVED" },
          corporateUserRequestInfo: {
            fullName: "A",
            formContent: { content: [{ fieldName: "First Name", fieldValue: "A" }] },
          },
          kycRequestInfo: { kycId: "KYC1" },
        },
        {
          corporateIndividualRequest: { requestId: "EOD2", status: "APPROVED" },
          corporateUserRequestInfo: {
            fullName: "B",
            formContent: { content: [{ fieldName: "First Name", fieldValue: "B" }] },
          },
          kycRequestInfo: { kycId: "KYC2" },
        },
      ],
      corpIndvShareholders: [],
    });
    mockGetEntityOnboardingDetails.mockImplementation(async (id: string) => ({
      corporateIndividualRequest: { requestId: id, status: "APPROVED" },
      kycRequestInfo: { kycId: id === "EOD1" ? "KYC1" : "KYC2" },
    }));
    mockQueryKYCStatus.mockRejectedValueOnce(rateLimit());

    const fetcher = new AMLFetcherService();
    await expect(
      fetcher.fetchIndividualDirectorAMLStatuses("COD1", "org-1", "investor")
    ).rejects.toBeInstanceOf(AppError);

    expect(mockQueryKYCStatus).toHaveBeenCalledTimes(1);
  });
});
