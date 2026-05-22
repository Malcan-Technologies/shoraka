import { AppError } from "../../lib/http/error-handler";
import { SHORAKA_PROVIDER_STATUSES, deriveOperationalStatus, normalizeProviderStatus, shorakaStpService } from "./shoraka-stp-service";

import { prisma } from "../../lib/prisma";
import { putS3ObjectBuffer } from "../../lib/s3/client";
import { getCertificatePdf, getOrderStatus, submitOrder } from "./shoraka-stp-client";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    withdrawalInstruction: {
      findUnique: jest.fn(),
    },
    shorakaTradeOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    issuerOrganization: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../lib/s3/client", () => ({
  putS3ObjectBuffer: jest.fn(),
}));

jest.mock("./shoraka-stp-client", () => ({
  submitOrder: jest.fn(),
  getOrderStatus: jest.fn(),
  getCertificatePdf: jest.fn(),
}));

describe("shoraka-stp operational status mapping", () => {
  it("maps Active -> Matching in progress + cannot fetch certificate", () => {
    const operational = deriveOperationalStatus({
      providerStatusRaw: SHORAKA_PROVIDER_STATUSES.ACTIVE,
      hasCertificate: false,
      certificateMissing: true,
      cutoffWarning: null,
    });

    expect(normalizeProviderStatus(operational.providerStatus)).toBe(SHORAKA_PROVIDER_STATUSES.ACTIVE);
    expect(operational.label).toBe("Matching in progress");
    expect(operational.canFetchCertificate).toBe(false);
    expect(operational.nextAction).toBe("Query status again later");
  });
});

describe("shoraka-stp fetch-certificate guard (Phase 1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects when provider status is Active", async () => {
    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      withdrawal_type: "ISSUER_DISBURSEMENT",
      metadata: {},
      note_id: "note-1",
      issuer_organization_id: null,
    });

    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue({
      provider_order_id: "provider-order-1",
      status: SHORAKA_PROVIDER_STATUSES.ACTIVE,
      certificate_s3_key: null,
    });

    await expect(shorakaStpService.fetchCertificateForWithdrawal("withdrawal-1")).rejects.toThrow(
      /Shoraka certificate can only be fetched after the order status is Completed/
    );

    expect(getCertificatePdf).not.toHaveBeenCalled();
    expect(putS3ObjectBuffer).not.toHaveBeenCalled();
  });

  it("allows fetch when provider status is Completed", async () => {
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);

    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue({
      withdrawal_type: "ISSUER_DISBURSEMENT",
      metadata: {},
      note_id: "note-1",
      issuer_organization_id: null,
    });

    // First findUnique: tradeOrder for guard + fetch-certificate.
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValueOnce({
      provider_order_id: "provider-order-1",
      status: SHORAKA_PROVIDER_STATUSES.COMPLETED,
      certificate_s3_key: null,
    });

    // Second findUnique: getStateForWithdrawal after upload/update.
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "trade-order-1",
      withdrawal_instruction_id: "withdrawal-1",
      note_id: "note-1",
      provider_order_id: "provider-order-1",
      status: SHORAKA_PROVIDER_STATUSES.COMPLETED,
      idempotency_key: "idem-1",
      submitted_at: new Date("2026-01-01T00:00:00Z"),
      status_last_checked_at: null,
      submit_request_payload: {
        value_date: "01/01/2026",
        order_amount: "100.00",
        murabaha_amount: "100.00",
        ownership: "Issuer Name",
      },
      submit_response_payload: {},
      status_response_payload: {},
      certificate_s3_key: "shoraka-certificates/withdrawal-1/provider-order-1-1700000000000.pdf",
      certificate_file_sha256: "sha256",
      provider_certificate_id: null,
      certificate_uploaded_at: new Date("2026-01-01T00:00:00Z"),
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-01T00:00:00Z"),
    });

    (getCertificatePdf as jest.Mock).mockResolvedValue(Buffer.from("pdf-bytes"));
    (putS3ObjectBuffer as jest.Mock).mockResolvedValue(undefined);
    (prisma.shorakaTradeOrder.update as jest.Mock).mockResolvedValue(undefined);

    await shorakaStpService.fetchCertificateForWithdrawal("withdrawal-1");

    expect(getCertificatePdf).toHaveBeenCalledTimes(1);
    expect(putS3ObjectBuffer).toHaveBeenCalledTimes(1);
    const callArgs = (putS3ObjectBuffer as jest.Mock).mock.calls[0][0];
    expect(callArgs.key).toContain(
      "shoraka-certificates/withdrawal-1/provider-order-1-1700000000000.pdf"
    );

    dateNowSpy.mockRestore();
  });
});

describe("shoraka-stp cutoff window (submit-order)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function baseWithdrawalFixture() {
    return {
      withdrawal_type: "ISSUER_DISBURSEMENT",
      note_id: "note-1",
      issuer_organization_id: null,
      metadata: { grossFundedAmount: 1000, issuerOrganizationName: "Issuer Name" },
      beneficiary_snapshot: {},
    };
  }

  it("rejects submit-order during unsafe window (23:30–00:29 MYT)", async () => {
    jest.useFakeTimers();
    // Malaysia = UTC+8, so 23:45 MYT = 15:45 UTC
    jest.setSystemTime(new Date("2026-05-21T15:45:00Z"));

    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(baseWithdrawalFixture());
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(shorakaStpService.submitOrderForWithdrawal("withdrawal-1")).rejects.toMatchObject({
      code: "SHORAKA_CUTOFF_WINDOW",
      statusCode: 400,
    });

    expect(submitOrder).not.toHaveBeenCalled();
  });

  it("allows submit-order before 23:30 MYT", async () => {
    jest.useFakeTimers();
    // Malaysia 23:15 MYT = 15:15 UTC
    jest.setSystemTime(new Date("2026-05-21T15:15:00Z"));

    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(baseWithdrawalFixture());
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue(null);

    (submitOrder as jest.Mock).mockResolvedValue({
      response: { orderId: "provider-order-1", status: "Active" },
    });

    (prisma.shorakaTradeOrder.create as jest.Mock).mockResolvedValue({
      id: "trade-order-1",
      withdrawal_instruction_id: "withdrawal-1",
      note_id: "note-1",
      provider_order_id: "provider-order-1",
      status: "Active",
      idempotency_key: "idem-1",
      submitted_at: new Date("2026-05-21T15:15:00Z"),
      status_last_checked_at: null,
      submit_request_payload: {},
      submit_response_payload: {},
      status_response_payload: {},
      callback_payload: null,
      callback_received_at: null,
      certificate_s3_key: null,
      certificate_file_sha256: null,
      provider_certificate_id: null,
      certificate_uploaded_at: null,
      created_at: new Date("2026-05-21T15:15:00Z"),
      updated_at: new Date("2026-05-21T15:15:00Z"),
    });

    await expect(shorakaStpService.submitOrderForWithdrawal("withdrawal-1")).resolves.toMatchObject({
      tradeOrder: expect.objectContaining({
        provider_order_id: "provider-order-1",
        status: "Active",
      }),
    });

    expect(submitOrder).toHaveBeenCalledTimes(1);
  });

  it("allows submit-order after 00:30 MYT", async () => {
    jest.useFakeTimers();
    // Malaysia 00:30 MYT = 16:30 UTC (previous day)
    jest.setSystemTime(new Date("2026-05-21T16:30:00Z"));

    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(baseWithdrawalFixture());
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue(null);

    (submitOrder as jest.Mock).mockResolvedValue({
      response: { orderId: "provider-order-2", status: "Active" },
    });

    (prisma.shorakaTradeOrder.create as jest.Mock).mockResolvedValue({
      id: "trade-order-2",
      withdrawal_instruction_id: "withdrawal-1",
      note_id: "note-1",
      provider_order_id: "provider-order-2",
      status: "Active",
      idempotency_key: "idem-2",
      submitted_at: new Date("2026-05-21T16:30:00Z"),
      status_last_checked_at: null,
      submit_request_payload: {},
      submit_response_payload: {},
      status_response_payload: {},
      callback_payload: null,
      callback_received_at: null,
      certificate_s3_key: null,
      certificate_file_sha256: null,
      provider_certificate_id: null,
      certificate_uploaded_at: null,
      created_at: new Date("2026-05-21T16:30:00Z"),
      updated_at: new Date("2026-05-21T16:30:00Z"),
    });

    await expect(shorakaStpService.submitOrderForWithdrawal("withdrawal-1")).resolves.toMatchObject({
      tradeOrder: expect.objectContaining({
        provider_order_id: "provider-order-2",
        status: "Active",
      }),
    });
  });

  it("does not block query-status during unsafe window", async () => {
    jest.useFakeTimers();
    // Malaysia 23:45 MYT = 15:45 UTC
    jest.setSystemTime(new Date("2026-05-21T15:45:00Z"));

    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(baseWithdrawalFixture());

    (prisma.shorakaTradeOrder.findUnique as jest.Mock)
      // queryStatusForWithdrawal: first findUnique (guard provider_order_id)
      .mockResolvedValueOnce({
        provider_order_id: "provider-order-1",
        status: "Active",
      })
      // getStateForWithdrawal: second findUnique (build response)
      .mockResolvedValueOnce({
        id: "trade-order-1",
        withdrawal_instruction_id: "withdrawal-1",
        note_id: "note-1",
        provider_order_id: "provider-order-1",
        status: "Completed",
        idempotency_key: "idem-1",
        submitted_at: new Date("2026-05-21T15:45:00Z"),
        status_last_checked_at: new Date("2026-05-21T15:45:00Z"),
        callback_payload: null,
        callback_received_at: null,
        submit_request_payload: {},
        submit_response_payload: {},
        status_response_payload: {},
        certificate_s3_key: null,
        certificate_file_sha256: null,
        provider_certificate_id: null,
        certificate_uploaded_at: null,
        created_at: new Date("2026-05-21T15:45:00Z"),
        updated_at: new Date("2026-05-21T15:45:00Z"),
      });

    (getOrderStatus as jest.Mock).mockResolvedValue({
      status: "Completed",
    });

    (prisma.shorakaTradeOrder.update as jest.Mock).mockResolvedValue(undefined);

    await expect(shorakaStpService.queryStatusForWithdrawal("withdrawal-1")).resolves.toBeDefined();
  });

  it("does not block fetch-certificate during unsafe window", async () => {
    jest.useFakeTimers();
    // Malaysia 23:45 MYT = 15:45 UTC
    jest.setSystemTime(new Date("2026-05-21T15:45:00Z"));

    (prisma.withdrawalInstruction.findUnique as jest.Mock).mockResolvedValue(baseWithdrawalFixture());

    (prisma.shorakaTradeOrder.findUnique as jest.Mock)
      // fetchCertificateForWithdrawal: first findUnique (provider status + missing certificate)
      .mockResolvedValueOnce({
        id: "trade-order-1",
        withdrawal_instruction_id: "withdrawal-1",
        note_id: "note-1",
        provider_order_id: "provider-order-1",
        status: "Completed",
        certificate_s3_key: null,
        callback_payload: null,
        callback_received_at: null,
      })
      // getStateForWithdrawal: second findUnique
      .mockResolvedValueOnce({
        id: "trade-order-1",
        withdrawal_instruction_id: "withdrawal-1",
        note_id: "note-1",
        provider_order_id: "provider-order-1",
        status: "Completed",
        idempotency_key: "idem-1",
        submitted_at: new Date("2026-05-21T15:45:00Z"),
        status_last_checked_at: null,
        callback_payload: null,
        callback_received_at: null,
        submit_request_payload: {},
        submit_response_payload: {},
        status_response_payload: {},
        certificate_s3_key: "shoraka-certificates/withdrawal-1/provider-order-1-1700000000000.pdf",
        certificate_file_sha256: "sha",
        provider_certificate_id: null,
        certificate_uploaded_at: new Date("2026-05-21T15:45:00Z"),
        created_at: new Date("2026-05-21T15:45:00Z"),
        updated_at: new Date("2026-05-21T15:45:00Z"),
      });

    (getCertificatePdf as jest.Mock).mockResolvedValue(Buffer.from("pdf-bytes"));
    (putS3ObjectBuffer as jest.Mock).mockResolvedValue(undefined);
    (prisma.shorakaTradeOrder.update as jest.Mock).mockResolvedValue(undefined);

    await expect(shorakaStpService.fetchCertificateForWithdrawal("withdrawal-1")).resolves.toBeDefined();
    expect(getCertificatePdf).toHaveBeenCalledTimes(1);
  });
});

