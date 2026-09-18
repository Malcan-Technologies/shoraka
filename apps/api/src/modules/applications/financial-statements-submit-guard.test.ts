import { addDays, format, startOfDay } from "date-fns";
import { FINANCIAL_YEAR_END_ERROR_MESSAGES, getIssuerFinancialTabYears } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import {
  assertFinancialStatementsReadyForInitialSubmit,
  assertFinancialStatementsReadyForInitialSubmitIfActive,
} from "./financial-statements-submit-guard";

const mockFindById = jest.fn();
const mockUpdate = jest.fn();
const mockVerifyAccess = jest.fn();

jest.mock("./repository", () => ({
  ApplicationRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindById(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  })),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({ findById: jest.fn() })),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../contracts/repository", () => ({
  ContractRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped: jest.fn().mockResolvedValue({ id: "notif-1" }),
    logTypedSystemBatch: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock("../notification/application-recipients", () => ({
  getIssuerRecipientUserIdsForApplication: jest.fn().mockResolvedValue(["owner-1"]),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        invoice: { updateMany: jest.fn() },
        applicationRevision: { create: jest.fn() },
        application: {
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ display_reference: "APP-1" }),
        },
        applicationLog: { create: jest.fn().mockResolvedValue({ id: "log-1" }) },
      })
    ),
    invoice: { updateMany: jest.fn() },
    applicationRevision: { create: jest.fn() },
    application: { findUnique: jest.fn().mockResolvedValue(null) },
    product: { findUnique: jest.fn() },
  },
}));
jest.mock("../legal-documents/acceptance-service", () => ({
  legalDocumentAcceptanceService: { assertNoPendingReacceptance: jest.fn() },
}));
jest.mock("../payment/processing-fee-service", () => ({
  assertApplicationProcessingFeePaid: jest.fn(),
}));
jest.mock("./supporting-docs-workflow", () => ({
  assertRequiredSupportingDocumentsPresent: jest.fn(),
}));
jest.mock("./product-rules-on-submit", () => ({
  assertProductRulesForSubmit: jest.fn(),
}));
jest.mock("./issuer-organization-financial-statements", () => ({
  upsertLatestOrganizationFinancialStatementsFromApplication: jest.fn(),
}));
jest.mock("./director-shareholder-onboarding-guard", () => ({
  assertIssuerOrgDirectorShareholderOnboardingReady: jest.fn(),
}));
jest.mock("../organization-profile/service", () => ({
  assertIssuerProfileCompleteForSubmit: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../paymaster/service", () => ({
  linkPaymasterForApplicationSubmission: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../../lib/prisma";
import { linkPaymasterForApplicationSubmission } from "../paymaster/service";
import { ApplicationService } from "./service";

function yearBlock(pldd: string) {
  return {
    pldd,
    bsfatot: 1,
    othass: 0,
    bscatot: 0,
    bsclbank: 0,
    curlib: 0,
    bsslltd: 0,
    bsclstd: 0,
    bsqpuc: 0,
    turnover: 10,
    plnpbt: 0,
    plnpat: 0,
    plnetdiv: 0,
    plyear: 0,
  };
}

function payloadForFye(fyeIso: string, now = new Date()) {
  const questionnaire = { financial_year_end: fyeIso };
  const years = getIssuerFinancialTabYears(questionnaire, now);
  const unaudited_by_year: Record<string, ReturnType<typeof yearBlock>> = {};
  for (const y of years) {
    unaudited_by_year[String(y)] = yearBlock(`${y}-12-31`);
  }
  return { questionnaire, unaudited_by_year };
}

describe("assertFinancialStatementsReadyForInitialSubmit", () => {
  it("rejects a stale far-future FYE with a Financial Statements message", () => {
    const stale = payloadForFye(format(addDays(startOfDay(new Date()), 400), "yyyy-MM-dd"));
    expect(() => assertFinancialStatementsReadyForInitialSubmit(stale)).toThrow(AppError);
    try {
      assertFinancialStatementsReadyForInitialSubmit(stale);
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
      expect((error as AppError).message).toContain("Financial Statements:");
      expect((error as AppError).message).toContain(FINANCIAL_YEAR_END_ERROR_MESSAGES.beyond_window);
    }
  });

  it("accepts a draft FYE inside the 12-month window", () => {
    const valid = payloadForFye(format(addDays(startOfDay(new Date()), 120), "yyyy-MM-dd"));
    expect(() => assertFinancialStatementsReadyForInitialSubmit(valid)).not.toThrow();
  });

  it("skips the workflow-gated assert when financial statements is not an active step", () => {
    const stale = payloadForFye(format(addDays(startOfDay(new Date()), 400), "yyyy-MM-dd"));
    expect(() =>
      assertFinancialStatementsReadyForInitialSubmitIfActive([{ id: "company_details" }], stale)
    ).not.toThrow();
  });

  it("still rejects a stale FYE when financial statements is an active step", () => {
    const stale = payloadForFye(format(addDays(startOfDay(new Date()), 400), "yyyy-MM-dd"));
    expect(() =>
      assertFinancialStatementsReadyForInitialSubmitIfActive([{ id: "financial_statements_1" }], stale)
    ).toThrow(AppError);
  });
});

describe("ApplicationService.updateApplicationStatus — financial statements submit guard", () => {
  const service = new ApplicationService();

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.application.findUnique as jest.Mock).mockResolvedValue(null);
    mockVerifyAccess.mockResolvedValue(undefined);
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess =
      mockVerifyAccess;
    (service as unknown as { verifyApplicationEditable: (app: unknown) => void }).verifyApplicationEditable =
      () => undefined;
    (service as unknown as { getProductWorkflowForApplication: jest.Mock }).getProductWorkflowForApplication =
      jest.fn().mockResolvedValue([{ id: "financial_statements" }, { id: "company_details" }]);
  });

  it("blocks initial SUBMIT of a stale far-future FYE draft", async () => {
    const stale = payloadForFye(format(addDays(startOfDay(new Date()), 400), "yyyy-MM-dd"));
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      financing_type: { product_id: "prod_1" },
      financing_structure: {},
      financial_statements: stale,
      invoices: [],
      contract: null,
      contract_id: null,
    });

    await expect(service.updateApplicationStatus("app-1", "SUBMITTED", "user-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("Financial Statements:"),
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(linkPaymasterForApplicationSubmission).not.toHaveBeenCalled();
    expect(prisma.application.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a stale FYE before paymaster linking when a contract exists", async () => {
    const stale = payloadForFye(format(addDays(startOfDay(new Date()), 400), "yyyy-MM-dd"));
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      financing_type: { product_id: "prod_1" },
      financing_structure: {},
      financial_statements: stale,
      invoices: [],
      contract: { id: "contract-1" },
      contract_id: "contract-1",
    });

    await expect(service.updateApplicationStatus("app-1", "SUBMITTED", "user-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("Financial Statements:"),
    });
    expect(linkPaymasterForApplicationSubmission).not.toHaveBeenCalled();
    expect(prisma.application.findUnique).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows initial SUBMIT when the stored FYE is inside the window", async () => {
    const valid = payloadForFye(format(addDays(startOfDay(new Date()), 120), "yyyy-MM-dd"));
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      financing_type: { product_id: "prod_1" },
      financing_structure: {},
      financial_statements: valid,
      invoices: [],
      contract: null,
      contract_id: null,
    });

    await expect(service.updateApplicationStatus("app-1", "SUBMITTED", "user-1")).resolves.toBeTruthy();
  });
});
