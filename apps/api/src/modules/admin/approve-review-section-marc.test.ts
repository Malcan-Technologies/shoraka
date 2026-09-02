const mockApply = jest.fn();
const mockLockContractRow = jest.fn();

jest.mock("../../lib/refresh-contract-facility", () => ({
  applyContractCapacityChange: (...args: unknown[]) => mockApply(...args),
  lockContractRow: (...args: unknown[]) => mockLockContractRow(...args),
}));

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({})),
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
jest.mock("../../lib/http/request-utils", () => ({
  extractRequestMetadata: () => ({
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    deviceInfo: "test",
    deviceType: "desktop",
  }),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganizationMarcAssessment: {
      findFirst: jest.fn(),
    },
  },
}));

import { MARC_ASSESSMENT_REQUIRED_MESSAGE } from "@cashsouk/types";
import { AdminService } from "./service";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";

describe("AdminService approveReviewSection MARC", () => {
  const service = new AdminService();
  const repository = {
    ensureApplicationReviewSection: jest.fn(),
    updateSectionReviewStatus: jest.fn(),
    upsertReviewRemark: jest.fn(),
    removeDraftAmendment: jest.fn(),
    getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
      .fn()
      .mockResolvedValue({
        repository,
        application: {
          id: "app-1",
          status: "UNDER_REVIEW",
          issuer_organization_id: "org-1",
          issuer_organization: null,
          application_reviews: [],
        },
      });
    (service as unknown as { ensureUnderReview: jest.Mock }).ensureUnderReview = jest.fn();
    (service as unknown as { logReviewActivity: jest.Mock }).logReviewActivity = jest.fn();
    (service as unknown as { syncAdminStageStatus: jest.Mock }).syncAdminStageStatus = jest.fn();
  });

  it("blocks financial approve when the issuer organization has no MARC assessment", async () => {
    (prisma.issuerOrganizationMarcAssessment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.approveReviewSection("app-1", "financial", "admin-1")
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MARC_ASSESSMENT_REQUIRED",
      message: MARC_ASSESSMENT_REQUIRED_MESSAGE,
    } satisfies Partial<AppError>);
    expect(repository.updateSectionReviewStatus).not.toHaveBeenCalled();
  });

  it("blocks financial approve when the issuer MARC assessment is incomplete", async () => {
    (prisma.issuerOrganizationMarcAssessment.findFirst as jest.Mock).mockResolvedValue({
      credit_grade: "SME-3",
      credit_score: null,
      probability_of_default: null,
      report_date: null,
      report_file_name: null,
      report_s3_key: null,
      created_at: new Date("2026-08-01T00:00:00.000Z"),
    });

    await expect(
      service.approveReviewSection("app-1", "financial", "admin-1")
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MARC_ASSESSMENT_REQUIRED",
      message: MARC_ASSESSMENT_REQUIRED_MESSAGE,
    } satisfies Partial<AppError>);
    expect(repository.updateSectionReviewStatus).not.toHaveBeenCalled();
  });

  it("allows financial approve when MARC is complete", async () => {
    (prisma.issuerOrganizationMarcAssessment.findFirst as jest.Mock).mockResolvedValue({
      credit_grade: "SME-3",
      credit_score: 70,
      probability_of_default: 5.1,
      report_date: new Date("2026-08-01T00:00:00.000Z"),
      report_file_name: "marc.pdf",
      report_s3_key: "marc-reports/org-1/marc.pdf",
      created_at: new Date("2026-08-01T00:00:00.000Z"),
    });

    await service.approveReviewSection("app-1", "financial", "admin-1");

    expect(repository.updateSectionReviewStatus).toHaveBeenCalled();
  });

  it("does not require MARC when approving a non-financial section", async () => {
    await service.approveReviewSection("app-1", "company_details", "admin-1");

    expect(prisma.issuerOrganizationMarcAssessment.findFirst).not.toHaveBeenCalled();
    expect(repository.updateSectionReviewStatus).toHaveBeenCalled();
  });
});
