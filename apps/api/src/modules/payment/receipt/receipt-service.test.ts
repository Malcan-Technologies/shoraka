/**
 * Unit tests for receipt generation orchestration with mocked Prisma/S3/PDF.
 */

jest.mock("../../../lib/s3/client", () => ({
  putS3ObjectBuffer: jest.fn(async () => undefined),
}));

jest.mock("./render-receipt-html-to-pdf", () => ({
  renderReceiptHtmlToPdfBuffer: jest.fn(async () => Buffer.from("%PDF-mock")),
}));

import {
  GatewayPaymentPurpose,
  GatewayPaymentReceiptStatus,
  GatewayPaymentStatus,
  OrganizationType,
} from "@prisma/client";
import { putS3ObjectBuffer } from "../../../lib/s3/client";
import { generateGatewayPaymentReceipt } from "./receipt-service";
import { renderReceiptHtmlToPdfBuffer } from "./render-receipt-html-to-pdf";

function createDbMock(overrides?: {
  payment?: Record<string, unknown> | null;
  existingReceipt?: Record<string, unknown> | null;
}) {
  const payment =
    overrides && "payment" in overrides
      ? overrides.payment
      : {
          id: "pay_1",
          purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
          status: GatewayPaymentStatus.COMPLETED,
          amount: { toNumber: () => 150 },
          currency: "MYR",
          method: "fpx",
          payer_name: null,
          curlec_payment_id: "pay_curlec_1",
          curlec_order_id: "order_1",
          updated_at: new Date("2026-08-03T02:00:00.000Z"),
          metadata: null,
          investor_organization: null,
          issuer_organization: {
            id: "issuer_1",
            type: OrganizationType.COMPANY,
            name: "Issuer Co",
            registration_number: "SSM-1",
            first_name: null,
            middle_name: null,
            last_name: null,
            phone_number: "012",
            corporate_onboarding_data: { basicInfo: { businessName: "Issuer Co" } },
            owner: { email: "issuer@example.com", phone: "012" },
          },
          application: null,
        };

  const receiptRow = {
    id: "rcp_1",
    receipt_number: "RCP-20260803-001",
    gateway_payment_id: "pay_1",
    payment_purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
    purpose_label: "Issuer Registration Fee",
    payer_name: null,
    payer_company_name: "Issuer Co",
    payer_email: "issuer@example.com",
    payer_phone: "012",
    amount: { toNumber: () => 150 },
    currency: "MYR",
    payment_method: "fpx",
    payment_date: new Date("2026-08-03T02:00:00.000Z"),
    curlec_payment_id: "pay_curlec_1",
    curlec_order_id: "order_1",
    related_entity_type: "ISSUER_ORGANIZATION",
    related_entity_id: "issuer_1",
    related_reference: "SSM-1",
    wallet_credited: false,
    pdf_s3_key: null,
    status: GatewayPaymentReceiptStatus.PENDING,
    generation_error: null,
    generated_at: null,
    created_at: new Date("2026-08-03T02:00:00.000Z"),
  };

  const existing = overrides?.existingReceipt ?? null;

  return {
    gatewayPayment: {
      findUnique: jest.fn(async () => payment),
    },
    platformFinanceSetting: {
      findUnique: jest.fn(async () => null),
    },
    gatewayPaymentReceipt: {
      findUnique: jest.fn(async () => existing),
      create: jest.fn(async () => receiptRow),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...receiptRow,
        ...data,
      })),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        gatewayPaymentReceipt: {
          findUnique: jest.fn(async () => existing),
          create: jest.fn(async () => receiptRow),
        },
        $queryRaw: jest.fn(async () => [{ last_value: 1 }]),
      };
      return fn(tx);
    }),
  };
}

describe("generateGatewayPaymentReceipt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips non-completed payments", async () => {
    const db = createDbMock({
      payment: {
        id: "pay_1",
        status: GatewayPaymentStatus.FAILED,
      },
    });

    const result = await generateGatewayPaymentReceipt("pay_1", db as never);
    expect(result).toBeNull();
    expect(putS3ObjectBuffer).not.toHaveBeenCalled();
  });

  it("creates and generates a registration-fee receipt once", async () => {
    const db = createDbMock();
    const result = await generateGatewayPaymentReceipt("pay_1", db as never);

    expect(result?.status).toBe(GatewayPaymentReceiptStatus.GENERATED);
    expect(result?.purpose_label).toBe("Issuer Registration Fee");
    expect(renderReceiptHtmlToPdfBuffer).toHaveBeenCalledTimes(1);
    expect(putS3ObjectBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "receipts/2026/08/RCP-20260803-001.pdf",
        contentType: "application/pdf",
      })
    );
  });

  it("does not regenerate an already GENERATED receipt", async () => {
    const db = createDbMock({
      existingReceipt: {
        id: "rcp_1",
        receipt_number: "RCP-20260803-001",
        gateway_payment_id: "pay_1",
        status: GatewayPaymentReceiptStatus.GENERATED,
        pdf_s3_key: "receipts/2026/08/RCP-20260803-001.pdf",
      },
    });

    const result = await generateGatewayPaymentReceipt("pay_1", db as never);
    expect(result?.status).toBe(GatewayPaymentReceiptStatus.GENERATED);
    expect(renderReceiptHtmlToPdfBuffer).not.toHaveBeenCalled();
    expect(putS3ObjectBuffer).not.toHaveBeenCalled();
  });

  it("marks FAILED and keeps the same receipt number when PDF generation fails", async () => {
    (renderReceiptHtmlToPdfBuffer as jest.Mock).mockRejectedValueOnce(new Error("chrome down"));
    const db = createDbMock();

    const result = await generateGatewayPaymentReceipt("pay_1", db as never);
    expect(result?.status).toBe(GatewayPaymentReceiptStatus.FAILED);
    expect(db.gatewayPaymentReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GatewayPaymentReceiptStatus.FAILED,
        }),
      })
    );
  });
});
