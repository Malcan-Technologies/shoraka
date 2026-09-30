/**
 * SECTION: Admin financial field override writes
 * WHY: One FY can have a CTOS column and a User Input column. A CTOS gap-fill and an Admin edit
 * of User Input on the same field are stored per action and must not overwrite each other.
 */

import { ApplicationService } from "./service";

const mockReviewFindUnique = jest.fn();
const mockApplicationFindUnique = jest.fn();
const mockTransaction = jest.fn();
const mockLoadCtosReport = jest.fn();
const mockMergeIntoOrg = jest.fn();
const mockLogActivity = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    applicationReview: {
      findUnique: (...args: unknown[]) => mockReviewFindUnique(...args),
    },
    application: {
      findUnique: (...args: unknown[]) => mockApplicationFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock("./application-owned-ctos", () => ({
  loadApplicationOwnedCtosFinancialReport: (...args: unknown[]) => mockLoadCtosReport(...args),
}));

jest.mock("./issuer-organization-financial-statements", () => ({
  ...jest.requireActual("./issuer-organization-financial-statements"),
  mergeApplicationAdminFinancialSupplementsIntoOrg: (...args: unknown[]) => mockMergeIntoOrg(...args),
}));

jest.mock("./logs/service", () => ({
  ...jest.requireActual("./logs/service"),
  logApplicationActivity: (...args: unknown[]) => mockLogActivity(...args),
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

const AT = "2026-09-01T00:00:00.000Z";

const gapFill = {
  value: 100,
  baseSource: "ctos",
  action: "add_missing_ctos_field",
  updated_by_user_id: "admin-1",
  updated_at: AT,
};

const userEdit = {
  value: 120,
  baseSource: "user_input",
  action: "edit_user_input",
  updated_by_user_id: "admin-1",
  updated_at: AT,
};

/** FY2026 is both a CTOS column (tradeReceivables missing) and a User Input column. */
const baseFinancials = {
  unaudited_by_year: {
    "2027": { turnover: 70 },
    "2026": { turnover: 60, tradeReceivables: 50 },
  },
};

const ctosFinancials = [
  {
    financial_year: 2026,
    dates: { pldd: "2026-12-31", bsdd: null },
    account: { turnover: 900, tradeReceivables: null },
  },
];

describe("upsertAdminFinancialField keeps one override per action", () => {
  const service = new ApplicationService();
  let txUpdate: jest.Mock;

  function givenStoredFinancials(financialStatements: Record<string, unknown>) {
    mockApplicationFindUnique.mockResolvedValue({
      id: "app-1",
      status: "UNDER_REVIEW",
      submitted_at: new Date("2027-06-01T00:00:00.000Z"),
      issuer_organization_id: "org-1",
      financial_statements: financialStatements,
    });
  }

  function persistedFinancials(): Record<string, unknown> {
    expect(txUpdate).toHaveBeenCalledTimes(1);
    return (txUpdate.mock.calls[0]![0] as { data: { financial_statements: Record<string, unknown> } }).data
      .financial_statements;
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(AT) });
    jest.clearAllMocks();
    txUpdate = jest.fn().mockResolvedValue({});
    mockReviewFindUnique.mockResolvedValue({ status: "PENDING" });
    mockLoadCtosReport.mockResolvedValue({ financialsJson: ctosFinancials });
    mockMergeIntoOrg.mockResolvedValue(undefined);
    mockLogActivity.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRaw: jest.fn().mockResolvedValue([{ status: "UNDER_REVIEW" }]),
        applicationReview: { findUnique: jest.fn().mockResolvedValue({ status: "PENDING" }) },
        application: { update: txUpdate },
      })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("a User Input edit after a CTOS gap-fill keeps the gap-fill", async () => {
    givenStoredFinancials({
      ...baseFinancials,
      admin_field_overrides: { "2026": { tradeReceivables: { add_missing_ctos_field: gapFill } } },
    });
    await service.upsertAdminFinancialField({
      applicationId: "app-1",
      userId: "admin-1",
      financialYear: 2026,
      fieldKey: "tradeReceivables",
      columnKind: "unaudited",
      value: 120,
    });
    const saved = persistedFinancials();
    expect(saved.admin_field_overrides).toEqual({
      "2026": { tradeReceivables: { add_missing_ctos_field: gapFill, edit_user_input: userEdit } },
    });
    expect(saved.unaudited_by_year).toEqual(baseFinancials.unaudited_by_year);
    expect(saved.admin_input_by_year).toBeUndefined();
    expect(mockMergeIntoOrg).toHaveBeenCalledWith({ applicationId: "app-1" });
  });

  it("a CTOS gap-fill after a User Input edit keeps the edit (legacy stored entry)", async () => {
    givenStoredFinancials({
      ...baseFinancials,
      admin_field_overrides: { "2026": { tradeReceivables: userEdit } },
    });
    await service.upsertAdminFinancialField({
      applicationId: "app-1",
      userId: "admin-1",
      financialYear: 2026,
      fieldKey: "tradeReceivables",
      columnKind: "ctos",
      value: 100,
    });
    expect(persistedFinancials().admin_field_overrides).toEqual({
      "2026": { tradeReceivables: { add_missing_ctos_field: gapFill, edit_user_input: userEdit } },
    });
  });
});
