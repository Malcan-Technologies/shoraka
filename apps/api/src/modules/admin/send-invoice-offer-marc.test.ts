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
    invoice: { findUnique: jest.fn() },
    issuerOrganizationMarcAssessment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    application: {
      findUnique: jest.fn().mockResolvedValue({
        contract: {
          customer_details: {
            name: "ABC Trading Sdn Bhd",
            entity_type: "Private Limited Company (Sdn Bhd)",
            ssm_number: "202134567890",
            country: "MY",
          },
          paymaster: {
            legal_name: "ABC Trading Sdn Bhd",
            entity_type: "Private Limited Company (Sdn Bhd)",
            registration_number: "202134567890",
            registration_country: "MY",
            verification_status: "VERIFIED",
          },
        },
      }),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock("../applications/logs/service", () => ({
  logApplicationActivity: jest.fn(),
}));

import { addMytCalendarDays, MARC_ASSESSMENT_REQUIRED_MESSAGE, mytCalendarParts } from "@cashsouk/types";
import { AdminService } from "./service";
import { prisma } from "../../lib/prisma";
import { ApplicationStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

function ymdDaysFromNow(days: number): string {
  const parts = addMytCalendarDays(mytCalendarParts(new Date()), days);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function sqlText(arg: unknown): string {
  if (Array.isArray(arg)) return arg.join(" ");
  if (arg && typeof arg === "object" && "strings" in arg) {
    const strings = (arg as { strings?: unknown }).strings;
    if (Array.isArray(strings)) return strings.join(" ");
  }
  return String(arg ?? "");
}

describe("AdminService sendInvoiceOffer MARC risk rating", () => {
  const service = new AdminService();
  const maturityDate = ymdDaysFromNow(60);
  const details = {
    number: "INV-1",
    value: 80_000,
    financing_ratio_percent: 70,
    applied_financing: 40_000,
    maturity_date: maturityDate,
    financing_tenure_days: 90,
  };

  let lastTx: ReturnType<typeof createTx> | null = null;

  function createTx() {
    const lockedAt = new Date("2026-08-01T00:00:00.000Z");
    return {
      $queryRaw: jest.fn(async (sql: unknown) => {
        const text = sqlText(sql);
        if (text.includes("FROM applications")) {
          return [{ status: ApplicationStatus.INVOICE_PENDING }];
        }
        if (text.includes("FROM invoices") && text.includes("application_id")) {
          return [
            {
              status: "SUBMITTED",
              details,
              offer_details: null,
              contract_id: null,
              updated_at: lockedAt,
            },
          ];
        }
        return [];
      }),
      platformFinanceSetting: {
        upsert: jest.fn(async () => ({ platform_fee_rate_cap_percent: 5 })),
      },
      invoice: {
        findMany: jest.fn(async () => [{ status: "OFFER_SENT" }]),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      applicationReviewItem: { upsert: jest.fn() },
      applicationReviewEvent: { create: jest.fn() },
      application: { update: jest.fn() },
      issuerOrganizationMarcAssessment: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    lastTx = null;
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification =
      jest.fn();
    (
      service as unknown as { syncInvoiceDetailsSectionFromItems: jest.Mock }
    ).syncInvoiceDetailsSectionFromItems = jest.fn();
    (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
      .fn()
      .mockResolvedValue({
        repository: { getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }) },
        application: {
          id: "app-1",
          status: ApplicationStatus.INVOICE_PENDING,
          contract_id: null,
          issuer_organization_id: "org-1",
          invoices: [{ id: "inv-1", details }],
        },
      });
    (service as unknown as { ensureUnderReview: jest.Mock }).ensureUnderReview = jest.fn();
    (service as unknown as { resolveInvoiceScopeKeyById: jest.Mock }).resolveInvoiceScopeKeyById =
      jest.fn().mockReturnValue("invoice_details:0:INV-1");
    (
      service as unknown as { ensureInvoiceOfferItemActionAllowed: jest.Mock }
    ).ensureInvoiceOfferItemActionAllowed = jest.fn();
    (
      service as unknown as { assertNoActiveSigningPackage: jest.Mock }
    ).assertNoActiveSigningPackage = jest.fn();
    (
      service as unknown as { loadApplicationProductWorkflow: jest.Mock }
    ).loadApplicationProductWorkflow = jest.fn().mockResolvedValue([]);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      status: "SUBMITTED",
      contract_id: null,
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => {
      lastTx = createTx();
      return fn(lastTx);
    });
  });

  it("blocks send when the issuer organization has no MARC assessment", async () => {
    (prisma.issuerOrganizationMarcAssessment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.sendInvoiceOffer(
        "app-1",
        "inv-1",
        40_000,
        70,
        12,
        0,
        "SME-3",
        "admin-1",
        undefined,
        undefined,
        90
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MARC_ASSESSMENT_REQUIRED",
      message: MARC_ASSESSMENT_REQUIRED_MESSAGE,
    } satisfies Partial<AppError>);
    expect(prisma.issuerOrganizationMarcAssessment.create).not.toHaveBeenCalled();
    expect(prisma.issuerOrganizationMarcAssessment.update).not.toHaveBeenCalled();
  });

  it("blocks send when the issuer MARC assessment is incomplete", async () => {
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
      service.sendInvoiceOffer(
        "app-1",
        "inv-1",
        40_000,
        70,
        12,
        0,
        "SME-3",
        "admin-1",
        undefined,
        undefined,
        90
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MARC_ASSESSMENT_REQUIRED",
      message: MARC_ASSESSMENT_REQUIRED_MESSAGE,
    } satisfies Partial<AppError>);
  });

  it("saves an admin override without changing organization MARC", async () => {
    (prisma.issuerOrganizationMarcAssessment.findFirst as jest.Mock).mockResolvedValue({
      credit_grade: "SME-3",
      credit_score: 70,
      probability_of_default: 5.1,
      report_date: new Date("2026-08-01T00:00:00.000Z"),
      report_file_name: "marc.pdf",
      created_at: new Date("2026-08-01T00:00:00.000Z"),
    });

    await service.sendInvoiceOffer(
      "app-1",
      "inv-1",
      40_000,
      70,
      12,
      0,
      "SME-4",
      "admin-1",
      undefined,
      undefined,
      90
    );

    const offer = lastTx?.invoice.updateMany.mock.calls[0]?.[0]?.data?.offer_details as Record<
      string,
      unknown
    >;
    expect(offer.risk_rating).toBe("SME-4");
    expect(offer.marc_suggested_grade).toBe("SME-3");
    expect(prisma.issuerOrganizationMarcAssessment.create).not.toHaveBeenCalled();
    expect(prisma.issuerOrganizationMarcAssessment.update).not.toHaveBeenCalled();
    expect(lastTx?.issuerOrganizationMarcAssessment.create).not.toHaveBeenCalled();
    expect(lastTx?.issuerOrganizationMarcAssessment.update).not.toHaveBeenCalled();
  });

  it("defaults a new invoice to the current organization MARC grade when nothing is saved", async () => {
    const { resolveDefaultInvoiceRiskRating } = await import("@cashsouk/types");
    expect(resolveDefaultInvoiceRiskRating(null, "SME-3")).toBe("SME-3");
    expect(resolveDefaultInvoiceRiskRating("C", "SME-3")).toBe("SME-3");
    expect(resolveDefaultInvoiceRiskRating("A", null)).toBeNull();
  });
});
