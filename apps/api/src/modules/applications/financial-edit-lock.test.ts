import { ApplicationService } from "./service";

const mockFindUnique = jest.fn();
const mockApplicationFindUnique = jest.fn();
const mockApplicationUpdate = jest.fn();
const mockTransaction = jest.fn();
const mockLoadCtosReport = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    applicationReview: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    application: {
      findUnique: (...args: unknown[]) => mockApplicationFindUnique(...args),
      update: (...args: unknown[]) => mockApplicationUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    noteProspectusReview: {
      findFirst: jest.fn(),
    },
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

const APPROVED_MESSAGE =
  "Financial review is approved. Financials are read-only until that section is reopened.";
const NOT_REVIEWABLE_MESSAGE =
  "Financials are read-only because this application is no longer under review.";

describe("Financial review section lock", () => {
  const service = new ApplicationService();
  const { prisma } = jest.requireMock("../../lib/prisma") as {
    prisma: { noteProspectusReview: { findFirst: jest.Mock } };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows edits when the Financial section is open", async () => {
    mockFindUnique.mockResolvedValue({ status: "PENDING" });
    await expect(
      (service as any).assertAdminFinancialEditsOpen("app-1", "UNDER_REVIEW")
    ).resolves.toBeUndefined();
    expect(prisma.noteProspectusReview.findFirst).not.toHaveBeenCalled();
  });

  it("allows edits when no Financial review row exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(
      (service as any).assertAdminFinancialEditsOpen("app-1", "SUBMITTED")
    ).resolves.toBeUndefined();
  });

  it("locks edits when the Financial section is approved", async () => {
    mockFindUnique.mockResolvedValue({ status: "APPROVED" });
    await expect(
      (service as any).assertAdminFinancialEditsOpen("app-1", "UNDER_REVIEW")
    ).rejects.toMatchObject({
      code: "FINANCIAL_REVIEW_LOCKED",
      statusCode: 409,
      message: APPROVED_MESSAGE,
    });
  });

  it("unlocks when a financial amendment reopens the section", async () => {
    mockFindUnique.mockResolvedValue({ status: "AMENDMENT_REQUESTED" });
    await expect(
      (service as any).assertAdminFinancialEditsOpen("app-1", "RESUBMITTED")
    ).resolves.toBeUndefined();
  });

  it.each(["COMPLETED", "REJECTED", "WITHDRAWN", "ARCHIVED", "DRAFT", null])(
    "locks edits when the application is %s, without reading the Financial row",
    async (applicationStatus) => {
      mockFindUnique.mockResolvedValue({ status: "PENDING" });
      await expect(
        (service as any).assertAdminFinancialEditsOpen("app-1", applicationStatus)
      ).rejects.toMatchObject({
        code: "FINANCIAL_REVIEW_LOCKED",
        statusCode: 409,
        message: NOT_REVIEWABLE_MESSAGE,
      });
      expect(mockFindUnique).not.toHaveBeenCalled();
    }
  );

  it("does not consult Prospectus approval", async () => {
    mockFindUnique.mockResolvedValue({ status: "PENDING" });
    await (service as any).assertAdminFinancialEditsOpen("app-1", "UNDER_REVIEW");
    expect(prisma.noteProspectusReview.findFirst).not.toHaveBeenCalled();
  });
});

/**
 * Both Admin financial edit endpoints: the lock runs on the status the caller already loaded,
 * and a refused call never reaches CTOS loading or any write.
 */
describe("Admin financial edit endpoints honour the application review boundary", () => {
  const service = new ApplicationService();
  // Passing the lock reaches CTOS loading; stopping there keeps the allowed path write-free.
  const PAST_LOCK = new Error("past financial edit lock");

  const endpoints = [
    {
      name: "upsertAdminFinancialStatementFallbackYear",
      call: () =>
        service.upsertAdminFinancialStatementFallbackYear({
          applicationId: "app-1",
          userId: "admin-1",
          financialYear: 2024,
          statementType: "AUDITED",
          rawFinancialInputs: {},
        }),
    },
    {
      name: "upsertAdminFinancialField",
      call: () =>
        service.upsertAdminFinancialField({
          applicationId: "app-1",
          userId: "admin-1",
          financialYear: 2024,
          fieldKey: "revenue",
          value: 100,
        }),
    },
  ];

  function givenApplication(status: string) {
    mockApplicationFindUnique.mockResolvedValue({
      id: "app-1",
      status,
      submitted_at: new Date("2025-01-01T00:00:00.000Z"),
      issuer_organization_id: "org-1",
      financial_statements: { questionnaire: { financial_year_end: "2024-12-31" } },
    });
  }

  function expectNoWrite() {
    expect(mockLoadCtosReport).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockApplicationUpdate).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadCtosReport.mockRejectedValue(PAST_LOCK);
  });

  describe.each(endpoints)("$name", ({ call }) => {
    it.each([
      ["UNDER_REVIEW", { status: "PENDING" }],
      ["SUBMITTED", { status: "PENDING" }],
      ["UNDER_REVIEW", { status: "AMENDMENT_REQUESTED" }],
      ["RESUBMITTED", { status: "AMENDMENT_REQUESTED" }],
      ["UNDER_REVIEW", { status: "REJECTED" }],
      ["UNDER_REVIEW", null],
    ])("allows edits for a %s application with Financial row %j", async (appStatus, row) => {
      givenApplication(appStatus);
      mockFindUnique.mockResolvedValue(row);
      await expect(call()).rejects.toBe(PAST_LOCK);
      expect(mockLoadCtosReport).toHaveBeenCalledTimes(1);
    });

    it("refuses a reviewable application whose Financial section is approved", async () => {
      givenApplication("UNDER_REVIEW");
      mockFindUnique.mockResolvedValue({ status: "APPROVED" });
      await expect(call()).rejects.toMatchObject({
        code: "FINANCIAL_REVIEW_LOCKED",
        statusCode: 409,
        message: APPROVED_MESSAGE,
      });
      expectNoWrite();
    });

    // Another section's amendment reopens the application, not the approved Financial section.
    it("keeps Financial locked when another section is sent for amendment", async () => {
      givenApplication("AMENDMENT_REQUESTED");
      mockFindUnique.mockResolvedValue({ status: "APPROVED" });
      await expect(call()).rejects.toMatchObject({
        code: "FINANCIAL_REVIEW_LOCKED",
        message: APPROVED_MESSAGE,
      });
      expectNoWrite();
    });

    it.each(["COMPLETED", "REJECTED", "WITHDRAWN", "ARCHIVED", "DRAFT"])(
      "refuses a %s application while Financial is not approved",
      async (appStatus) => {
        givenApplication(appStatus);
        mockFindUnique.mockResolvedValue({ status: "PENDING" });
        await expect(call()).rejects.toMatchObject({
          code: "FINANCIAL_REVIEW_LOCKED",
          statusCode: 409,
          message: NOT_REVIEWABLE_MESSAGE,
        });
        expectNoWrite();
      }
    );

    it("reports the not-reviewable reason when Financial is also approved", async () => {
      givenApplication("COMPLETED");
      mockFindUnique.mockResolvedValue({ status: "APPROVED" });
      await expect(call()).rejects.toMatchObject({
        code: "FINANCIAL_REVIEW_LOCKED",
        message: NOT_REVIEWABLE_MESSAGE,
      });
      expectNoWrite();
    });
  });
});
