import { ApplicationService } from "./service";

const mockReviewFindUnique = jest.fn();
const mockApplicationFindUnique = jest.fn();
const mockLoadCtosReport = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    applicationReview: {
      findUnique: (...args: unknown[]) => mockReviewFindUnique(...args),
    },
    application: {
      findUnique: (...args: unknown[]) => mockApplicationFindUnique(...args),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("./application-owned-ctos", () => ({
  loadApplicationOwnedCtosFinancialReport: (...args: unknown[]) => mockLoadCtosReport(...args),
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

/**
 * Admin Input eligibility with a CTOS report (Admin Summary Case B).
 * Latest User Input FY 2024 gives historical slots 2021, 2022, 2023. CTOS owns 2021,
 * User Input covers 2022, so only 2023 may take a whole-year Admin Input.
 */
describe("upsertAdminFinancialStatementFallbackYear eligibility with CTOS", () => {
  const service = new ApplicationService();

  function call(financialYear: number) {
    return service.upsertAdminFinancialStatementFallbackYear({
      applicationId: "app-1",
      userId: "admin-1",
      financialYear,
      statementType: "AUDITED",
      rawFinancialInputs: {},
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockReviewFindUnique.mockResolvedValue({ status: "PENDING" });
    mockApplicationFindUnique.mockResolvedValue({
      id: "app-1",
      status: "UNDER_REVIEW",
      submitted_at: new Date("2025-06-01T00:00:00.000Z"),
      issuer_organization_id: "org-1",
      financial_statements: {
        questionnaire: { financial_year_end: "2024-12-31" },
        unaudited_by_year: {
          "2022": { bsfatot: 0 },
          "2024": { bsfatot: 100 },
        },
      },
    });
    mockLoadCtosReport.mockResolvedValue({
      id: "ctos-1",
      fetchedAt: new Date("2025-05-01T00:00:00.000Z"),
      financialsJson: [{ financial_year: 2021, dates: {}, account: { bsfatot: 50 } }],
    });
  });

  it("refuses a historical FY that has issuer User Input", async () => {
    await expect(call(2022)).rejects.toMatchObject({
      code: "ADMIN_FINANCIAL_STATEMENT_NOT_ELIGIBLE",
      statusCode: 400,
    });
  });

  it("refuses a historical FY owned by CTOS", async () => {
    await expect(call(2021)).rejects.toMatchObject({
      code: "ADMIN_FINANCIAL_STATEMENT_NOT_ELIGIBLE",
    });
  });

  it("accepts a historical FY covered by neither CTOS nor User Input", async () => {
    // Eligible years move on to block validation; the empty input fails there instead.
    await expect(call(2023)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
