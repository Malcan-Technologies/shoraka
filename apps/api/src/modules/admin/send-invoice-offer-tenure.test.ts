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

import { addMytCalendarDays, mytCalendarParts } from "@cashsouk/types";
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

describe("AdminService sendInvoiceOffer financing tenure", () => {
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
    };
  }

  beforeEach(() => {
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
      lastTx = createTx();
      return fn(lastTx);
    });
  });

  it("stamps admin-adjusted financing_tenure_days on offer_details", async () => {
    await service.sendInvoiceOffer(
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
      105
    );

    const offer = lastTx?.invoice.updateMany.mock.calls[0]?.[0]?.data?.offer_details as Record<
      string,
      unknown
    >;
    expect(offer.financing_tenure_days).toBe(105);
  });

  it("stamps campaign Technology/Non-Technology and sustainability onto offer_details", async () => {
    await service.sendInvoiceOffer(
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
      105,
      { companyCategory: "TECHNOLOGY", sustainabilityCategory: "G9" }
    );

    const offer = lastTx?.invoice.updateMany.mock.calls[0]?.[0]?.data?.offer_details as Record<
      string,
      unknown
    >;
    expect(offer.company_category).toBe("TECHNOLOGY");
    expect(offer.sustainability_category).toBe("G9");
  });

  it("rejects an offer tenure shorter than days remaining to the due date", async () => {
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
        30
      )
    ).rejects.toThrow(/at least 60 days|Financing tenure/);
  });

  it("rejects sending an offer when the invoice due date is already past", async () => {
    const pastDue = ymdDaysFromNow(-1);
    const pastDetails = { ...details, maturity_date: pastDue };
    (
      service as unknown as { prepareForReviewAction: jest.Mock }
    ).prepareForReviewAction.mockResolvedValue({
      repository: { getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }) },
      application: {
        id: "app-1",
        status: ApplicationStatus.INVOICE_PENDING,
        contract_id: null,
        invoices: [{ id: "inv-1", details: pastDetails }],
      },
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
        30
      )
    ).rejects.toThrow("Invoice due date cannot be in the past.");
  });
});
