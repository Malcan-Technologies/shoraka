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
    $transaction: jest.fn(),
  },
}));
jest.mock("../applications/logs/service", () => ({
  logApplicationActivity: jest.fn(),
}));

import { addMytCalendarDays, INVOICE_FINANCING_RATIO_CAP_MESSAGE, mytCalendarParts } from "@cashsouk/types";
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

describe("AdminService sendInvoiceOffer financing ratio cap", () => {
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
    };
  }

  beforeEach(() => {
    details = { ...baseDetails };
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
    ).loadApplicationProductWorkflow = jest.fn().mockResolvedValue([]);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      status: "SUBMITTED",
      contract_id: null,
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

  it("accepts an offer at exactly 80% of invoice face", async () => {
    await expect(send(80_000, 80)).resolves.toBeDefined();
  });

  it("rejects 80.01 / 81 / 100 even when the amount is within requested financing", async () => {
    for (const [amount, ratio] of [
      [80_010, 80.01],
      [81_000, 81],
      [80_000, 100],
    ] as const) {
      await expect(send(amount, ratio)).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_INPUT",
        message: INVOICE_FINANCING_RATIO_CAP_MESSAGE,
      } satisfies Partial<AppError>);
    }
  });

  it("rejects an offeredAmount above 80% of face when offeredRatioPercent is null", async () => {
    await expect(send(81_000, null)).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_INPUT",
      message: INVOICE_FINANCING_RATIO_CAP_MESSAGE,
    } satisfies Partial<AppError>);
  });

  it("accepts an offer that matches the issuer request at sen precision", async () => {
    details = {
      ...baseDetails,
      value: 80_527.92,
      financing_ratio_percent: 79,
    };
    delete (details as { applied_financing?: number }).applied_financing;
    await expect(send(63_617.06, 79)).resolves.toBeDefined();
  });

  it("accepts a sen-rounded 80% offer when face times 80% is not an exact sen", async () => {
    details = {
      ...baseDetails,
      value: 80_527.92,
      financing_ratio_percent: 80,
      applied_financing: 64_422.34,
    };
    await expect(send(64_422.34, 80)).resolves.toBeDefined();
  });
});
