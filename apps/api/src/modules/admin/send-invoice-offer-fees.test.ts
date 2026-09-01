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
import { AppError } from "../../lib/http/error-handler";

function invoiceDueDateWithinTenure(): string {
  const parts = addMytCalendarDays(mytCalendarParts(new Date()), 60);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

const invoiceOfferDetails = {
  number: "INV-1",
  value: 80_000,
  financing_ratio_percent: 70,
  applied_financing: 40_000,
  maturity_date: invoiceDueDateWithinTenure(),
  financing_tenure_days: 90,
};

const v1Schedule = (amount: number) => ({
  fee_schedule_version: 1,
  facility_fee_collect_amount: amount,
  additional_fees: [],
});

function sqlText(arg: unknown): string {
  if (Array.isArray(arg)) return arg.join(" ");
  if (arg && typeof arg === "object" && "strings" in arg) {
    const strings = (arg as { strings?: unknown }).strings;
    if (Array.isArray(strings)) return strings.join(" ");
  }
  return String(arg ?? "");
}

function createTx(options: {
  contractDetails: Record<string, unknown>;
  currentOfferDetails?: unknown;
  siblings?: Array<{ id: string; status: string; offer_details: unknown }>;
  notes?: Array<{
    source_invoice_id: string;
    status: string;
    funding_status: string;
    servicing_status?: string;
    invoice_snapshot: unknown;
  }>;
}) {
  const lockedAt = new Date("2026-08-01T00:00:00.000Z");
  const tx = {
    $queryRaw: jest.fn(async (sql: unknown) => {
      const text = sqlText(sql);
      if (text.includes("FROM applications")) {
        return [{ status: ApplicationStatus.INVOICE_PENDING }];
      }
      if (text.includes("FROM invoices") && text.includes("application_id")) {
        return [
          {
            status: "SUBMITTED",
            details: invoiceOfferDetails,
            offer_details: options.currentOfferDetails ?? null,
            contract_id: "contract-1",
            updated_at: lockedAt,
          },
        ];
      }
      return [];
    }),
    platformFinanceSetting: {
      upsert: jest.fn(async () => ({ platform_fee_rate_cap_percent: 5 })),
    },
    contract: {
      findUnique: jest.fn(async () => ({ contract_details: options.contractDetails })),
    },
    invoice: {
      findMany: jest.fn(async (args: { where?: { contract_id?: string } }) => {
        if (args?.where?.contract_id) return options.siblings ?? [];
        return [{ status: "OFFER_SENT" }];
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    note: {
      findMany: jest.fn(async () => options.notes ?? []),
    },
    applicationReviewItem: { upsert: jest.fn() },
    applicationReviewEvent: { create: jest.fn() },
    application: { update: jest.fn() },
  };
  return tx;
}

describe("AdminService sendInvoiceOffer facility fees", () => {
  const service = new AdminService();
  const repository = {
    getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }),
  };

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
        repository,
        application: {
          id: "app-1",
          status: ApplicationStatus.INVOICE_PENDING,
          contract_id: null,
          invoices: [
            {
              id: "inv-1",
              details: invoiceOfferDetails,
            },
          ],
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
      contract_id: "contract-1",
    });
  });

  async function sendCollect(
    amount: number,
    extra?: {
      feeScheduleMode?: "v1" | "preserve_grandfather";
      additionalFees?: { name: string; kind: "amount" | "percent_of_funded"; value: number }[];
    }
  ) {
    return service.sendInvoiceOffer(
      "app-1",
      "inv-1",
      40_000,
      70,
      12,
      0,
      "SME-3",
      "admin-1",
      undefined,
      {
        feeScheduleMode: extra?.feeScheduleMode,
        facilityFeeCollectAmount: amount,
        additionalFees: extra?.additionalFees,
      },
      90
    );
  }

  function writtenOfferDetails(tx: ReturnType<typeof createTx>): Record<string, unknown> {
    const call = tx.invoice.updateMany.mock.calls[0]?.[0] as {
      data?: { offer_details?: Record<string, unknown> };
    };
    return call?.data?.offer_details ?? {};
  }

  it("locks the invoice facility even when application.contract_id is unset", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await sendCollect(200);
    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      prisma,
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
  });

  it("locks and re-reads the contract before checking fees", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
    });
    const findOrder: string[] = [];
    mockLockContractRow.mockImplementation(async () => {
      findOrder.push("lock");
    });
    tx.contract.findUnique.mockImplementation(async () => {
      findOrder.push("read");
      return {
        contract_details: {
          facility_enabled: true,
          facility_fee_total_amount: 1_000,
          facility_fee_paid_amount: 0,
        },
      };
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await sendCollect(200);
    expect(mockLockContractRow).toHaveBeenCalledWith(tx, "contract-1");
    expect(findOrder).toEqual(["lock", "read"]);
  });

  it("rejects a facility-linked invoice offer while upfront facility fee is outstanding", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_500,
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 0,
      },
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await expect(sendCollect(0)).rejects.toMatchObject({
      code: "FACILITY_FEE_UPFRONT_REQUIRED",
      statusCode: 409,
    } satisfies Partial<AppError>);
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("uses post-lock contract details so a stale pre-lock read cannot send", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_500,
        facility_fee_paid_amount: 1_500,
      },
    });
    tx.contract.findUnique.mockResolvedValue({
      contract_details: {
        facility_enabled: true,
        facility_fee_total_amount: 1_500,
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 0,
      },
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await expect(sendCollect(0)).rejects.toMatchObject({
      code: "FACILITY_FEE_UPFRONT_REQUIRED",
    });
    expect(mockLockContractRow).toHaveBeenCalledWith(tx, "contract-1");
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("sends a facility-linked invoice offer after a facility fee waiver", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_500,
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 0,
        facility_fee_waived: true,
      },
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await sendCollect(0, { feeScheduleMode: "v1" });
    expect(tx.invoice.updateMany).toHaveBeenCalled();
  });

  it("rejects a facility-linked invoice offer while the contract is disabled", async () => {
    const tx = createTx({
      contractDetails: { facility_enabled: false, facility_disabled_reason: "Paused" },
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await expect(sendCollect(0)).rejects.toMatchObject({
      code: "FACILITY_DISABLED",
    } satisfies Partial<AppError>);
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a second pending offer that would overcommit remaining facility fee", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
      siblings: [{ id: "inv-a", status: "OFFER_SENT", offer_details: v1Schedule(800) }],
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await expect(sendCollect(800)).rejects.toMatchObject({
      code: "FACILITY_FEE_COLLECT_EXCEEDS_REMAINING",
    });
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });

  const grandfatherOffer = {
    offered_amount: 40_000,
    sent_at: "2026-01-01T00:00:00.000Z",
    version: 1,
    platform_fee_rate_percent: 0,
  };

  it("preserves absent schedule keys on an untouched grandfather resend even when UI defaults are posted", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
      currentOfferDetails: grandfatherOffer,
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await sendCollect(0);
    const written = writtenOfferDetails(tx);
    expect(written).not.toHaveProperty("fee_schedule_version");
    expect(written).not.toHaveProperty("facility_fee_collect_amount");
    expect(written).not.toHaveProperty("additional_fees");
  });

  it("writes v1 including intentional RM0 when converting a grandfather offer", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
      currentOfferDetails: grandfatherOffer,
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await sendCollect(0, { feeScheduleMode: "v1" });
    expect(writtenOfferDetails(tx)).toEqual(
      expect.objectContaining({
        fee_schedule_version: 1,
        facility_fee_collect_amount: 0,
        additional_fees: [],
      })
    );
  });

  it("writes v1 for a brand-new offer", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await sendCollect(0, { feeScheduleMode: "v1" });
    expect(writtenOfferDetails(tx)).toEqual(
      expect.objectContaining({
        fee_schedule_version: 1,
        facility_fee_collect_amount: 0,
        additional_fees: [],
      })
    );
  });

  it("rejects creating a new grandfather offer", async () => {
    const tx = createTx({
      contractDetails: {
        facility_enabled: true,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
    });
    mockApply.mockImplementation(async (_id, _db, mutate: (inner: unknown) => Promise<unknown>) => ({
      result: await mutate(tx),
      snapshot: null,
    }));

    await expect(sendCollect(0, { feeScheduleMode: "preserve_grandfather" })).rejects.toMatchObject({
      code: "FEE_SCHEDULE_MODE_INVALID",
    });
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });
});
