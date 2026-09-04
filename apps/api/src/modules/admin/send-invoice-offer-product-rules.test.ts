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

import { addMytCalendarDays, mytCalendarParts, PRODUCT_LIMIT_VIOLATION_CODE } from "@cashsouk/types";
import { AdminService } from "./service";
import { prisma } from "../../lib/prisma";
import { ApplicationStatus } from "@prisma/client";

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

describe("AdminService sendInvoiceOffer product rules", () => {
  const service = new AdminService();
  const invoiceFace = 100_000;
  const baseDetails = {
    number: "INV-1",
    value: invoiceFace,
    financing_ratio_percent: 80,
    applied_financing: 80_000,
    maturity_date: ymdDaysFromNow(60),
    financing_tenure_days: 90,
  };
  let details = { ...baseDetails };
  let lockedContractId: string | null = null;
  let workflow: unknown[] = [];

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
              contract_id: lockedContractId,
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
    };
  }

  beforeEach(() => {
    details = { ...baseDetails };
    lockedContractId = null;
    workflow = [
      {
        id: "invoice_details",
        config: {
          min_invoice_value: 50_000,
          max_financing_ratio_percent: 70,
          sub_limit_per_invoice_rm: 60_000,
        },
      },
    ];
    jest.clearAllMocks();
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
      service as unknown as { assertIssuerMarcReadyForInvoiceOffer: jest.Mock }
    ).assertIssuerMarcReadyForInvoiceOffer = jest
      .fn()
      .mockResolvedValue({ creditGrade: "SME-3" });
    (
      service as unknown as { loadApplicationProductWorkflow: jest.Mock }
    ).loadApplicationProductWorkflow = jest.fn().mockImplementation(async () => workflow);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      status: "SUBMITTED",
      contract_id: lockedContractId,
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => {
      return fn(createTx());
    });
  });

  async function send(offeredAmount: number, offeredRatioPercent: number | null) {
    return service.sendInvoiceOffer(
      "app-1",
      "inv-1",
      offeredAmount,
      offeredRatioPercent,
      12,
      0,
      "SME-3",
      "admin-1",
      undefined,
      undefined,
      90
    );
  }

  it("rejects offered ratio above the product max", async () => {
    await expect(send(75_000, 75)).rejects.toMatchObject({
      statusCode: 400,
      code: PRODUCT_LIMIT_VIOLATION_CODE,
      message: "Offered financing ratio cannot exceed 70%.",
    });
  });

  it("rejects offered financing below the product minimum", async () => {
    await expect(send(40_000, 40)).rejects.toMatchObject({
      statusCode: 400,
      code: PRODUCT_LIMIT_VIOLATION_CODE,
      message: "Offered financing must be at least RM 50,000.00.",
    });
  });

  it("rejects offered financing above the facility sub-limit", async () => {
    lockedContractId = "contract-1";
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      status: "SUBMITTED",
      contract_id: "contract-1",
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (tx: unknown) => unknown) => ({
      result: await mutate(createTx()),
    }));
    await expect(send(65_000, 65)).rejects.toMatchObject({
      statusCode: 400,
      code: PRODUCT_LIMIT_VIOLATION_CODE,
      message: "Offered financing cannot exceed the facility sub-limit of RM 60,000.00 per invoice.",
    });
  });

  it("ignores the sub-limit when the invoice has no facility", async () => {
    await expect(send(65_000, 65)).resolves.toBeDefined();
  });

  it("applies the sub-limit when only the application is linked to a facility", async () => {
    (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
      .fn()
      .mockResolvedValue({
        repository: { getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }) },
        application: {
          id: "app-1",
          status: ApplicationStatus.INVOICE_PENDING,
          contract_id: "contract-1",
          financing_structure: { structure_type: "existing_contract" },
          invoices: [{ id: "inv-1", details }],
        },
      });
    mockApply.mockImplementation(async (_id, _db, mutate: (tx: unknown) => unknown) => ({
      result: await mutate(createTx()),
    }));
    await expect(send(65_000, 65)).rejects.toMatchObject({
      code: PRODUCT_LIMIT_VIOLATION_CODE,
      message: "Offered financing cannot exceed the facility sub-limit of RM 60,000.00 per invoice.",
    });
  });

  it("ignores the sub-limit for standalone invoices even when a contract id is present", async () => {
    (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
      .fn()
      .mockResolvedValue({
        repository: { getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }) },
        application: {
          id: "app-1",
          status: ApplicationStatus.INVOICE_PENDING,
          contract_id: "contract-1",
          financing_structure: { structure_type: "invoice_only" },
          invoices: [{ id: "inv-1", details }],
        },
      });
    await expect(send(65_000, 65)).resolves.toBeDefined();
  });

  it("accepts an offer within product limits", async () => {
    await expect(send(60_000, 60)).resolves.toBeDefined();
  });
});
