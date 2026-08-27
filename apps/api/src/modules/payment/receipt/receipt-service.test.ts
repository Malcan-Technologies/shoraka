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
import { loadReceiptMerchantDetails } from "./receipt-merchant-config";
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
    payer_unique_id: null,
    payer_registration_number: "SSM-1",
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
    merchant_snapshot: null,
    created_at: new Date("2026-08-03T02:00:00.000Z"),
  };

  const existing = overrides?.existingReceipt ?? null;

  return {
    gatewayPayment: {
      findUnique: jest.fn(async () => payment),
      findMany: jest.fn(async () => []),
    },
    platformFinanceSetting: {
      findUnique: jest.fn(async () => null),
    },
    gatewayPaymentReceipt: {
      findUnique: jest.fn(async () => existing),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...receiptRow,
        ...data,
      })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...receiptRow,
        ...existing,
        ...data,
      })),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        gatewayPaymentReceipt: {
          findUnique: jest.fn(async () => existing),
          create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            ...receiptRow,
            ...data,
          })),
        },
        $queryRaw: jest.fn(async () => [{ last_value: 1 }]),
      };
      return fn(tx);
    }),
  };
}

describe("loadReceiptMerchantDetails", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("requires legal name and registration number in production", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      RECEIPT_MERCHANT_LEGAL_NAME: "",
      RECEIPT_MERCHANT_REGISTRATION_NUMBER: "",
    };
    expect(() => loadReceiptMerchantDetails("CashSouk Sdn Bhd")).toThrow(
      /RECEIPT_MERCHANT_CONFIG_REQUIRED/
    );
  });

  it("allows fallback legal name outside production", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      RECEIPT_MERCHANT_LEGAL_NAME: "",
      RECEIPT_MERCHANT_REGISTRATION_NUMBER: "",
    };
    const merchant = loadReceiptMerchantDetails("Fallback Co");
    expect(merchant.legalName).toBe("Fallback Co");
  });
});

describe("generateGatewayPaymentReceipt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
    delete process.env.RECEIPT_MERCHANT_LEGAL_NAME;
    delete process.env.RECEIPT_MERCHANT_REGISTRATION_NUMBER;
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
    const html = (renderReceiptHtmlToPdfBuffer as jest.Mock).mock.calls[0][0] as string;
    expect(html).toContain("Issuer Co");
    expect(html).toContain("Registration No.");
    expect(html).toContain("SSM-1");
    expect(html).not.toContain("Unique ID");
    expect(putS3ObjectBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "receipts/2026/08/RCP-20260803-001.pdf",
        contentType: "application/pdf",
      })
    );
  });

  it("stores the application canonical reference on new processing-fee receipts", async () => {
    const db = createDbMock({
      payment: {
        id: "pay_1",
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
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
        application: { id: "app_1", display_reference: "APP-ARF-202608-A82" },
        contract: null,
        note: null,
      },
    });

    await generateGatewayPaymentReceipt("pay_1", db as never);
    expect(renderReceiptHtmlToPdfBuffer).toHaveBeenCalledWith(
      expect.stringContaining("APP-ARF-202608-A82")
    );
    expect(renderReceiptHtmlToPdfBuffer).toHaveBeenCalledWith(
      expect.stringContaining("Application Reference")
    );
    expect(renderReceiptHtmlToPdfBuffer).not.toHaveBeenCalledWith(
      expect.stringContaining("app_1")
    );
  });

  it("prefers the issuer organization canonical reference on new registration-fee receipts", async () => {
    const db = createDbMock({
      payment: {
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
          display_reference: "ISS-202608-DK3",
          registration_number: "SSM-1",
          first_name: null,
          middle_name: null,
          last_name: null,
          phone_number: "012",
          corporate_onboarding_data: { basicInfo: { businessName: "Issuer Co" } },
          owner: { email: "issuer@example.com", phone: "012" },
        },
        application: null,
        contract: null,
        note: null,
      },
    });

    await generateGatewayPaymentReceipt("pay_1", db as never);
    expect(renderReceiptHtmlToPdfBuffer).toHaveBeenCalledWith(
      expect.stringContaining("ISS-202608-DK3")
    );
    expect(renderReceiptHtmlToPdfBuffer).not.toHaveBeenCalledWith(
      expect.stringContaining("issuer_1")
    );
  });

  it("does not regenerate when a PDF was already issued", async () => {
    const db = createDbMock({
      existingReceipt: {
        id: "rcp_1",
        receipt_number: "RCP-20260803-001",
        gateway_payment_id: "pay_1",
        payment_purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        purpose_label: "Issuer Registration Fee",
        status: GatewayPaymentReceiptStatus.GENERATED,
        pdf_s3_key: "receipts/2026/08/RCP-20260803-001.pdf",
        merchant_snapshot: null,
        amount: { toNumber: () => 150 },
        currency: "MYR",
        payment_method: "fpx",
        payment_date: new Date("2026-08-03T02:00:00.000Z"),
        curlec_payment_id: "pay_curlec_1",
        curlec_order_id: "order_1",
        related_reference: "SSM-1",
        payer_name: null,
        payer_company_name: "Issuer Co",
        payer_email: null,
        payer_phone: null,
        wallet_credited: false,
        created_at: new Date("2026-08-03T02:00:00.000Z"),
      },
    });

    const result = await generateGatewayPaymentReceipt("pay_1", db as never);
    expect(result?.pdf_s3_key).toBe("receipts/2026/08/RCP-20260803-001.pdf");
    expect(renderReceiptHtmlToPdfBuffer).not.toHaveBeenCalled();
    expect(putS3ObjectBuffer).not.toHaveBeenCalled();
  });

  it("marks FAILED and keeps the same receipt number when PDF generation fails", async () => {
    (renderReceiptHtmlToPdfBuffer as jest.Mock).mockRejectedValueOnce(new Error("chrome down"));
    const db = createDbMock();

    const result = await generateGatewayPaymentReceipt("pay_1", db as never);
    expect(result?.status).toBe(GatewayPaymentReceiptStatus.FAILED);
    expect(result?.receipt_number ?? "RCP-20260803-001").toBe("RCP-20260803-001");
    expect(db.gatewayPaymentReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GatewayPaymentReceiptStatus.FAILED,
        }),
      })
    );
  });

  it("snapshots investor company name from onboarding businessName only", async () => {
    const db = createDbMock({
      payment: {
        id: "pay_1",
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        status: GatewayPaymentStatus.COMPLETED,
        amount: { toNumber: () => 100 },
        currency: "MYR",
        method: "fpx",
        payer_name: "FPX PAYER",
        curlec_payment_id: "pay_curlec_1",
        curlec_order_id: "order_1",
        updated_at: new Date("2026-08-03T02:00:00.000Z"),
        metadata: null,
        issuer_organization: null,
        application: null,
        investor_organization: {
          id: "inv_1",
          type: OrganizationType.COMPANY,
          name: "Org Name Fallback Sdn Bhd",
          display_reference: "IVT-202608-C01",
          registration_number: "202201012345",
          first_name: null,
          middle_name: null,
          last_name: null,
          phone_number: "012",
          legal_name_on_id: null,
          corporate_onboarding_data: {
            basicInfo: { businessName: "Onboarding Business Sdn Bhd" },
          },
          owner: { email: "inv@example.com", phone: "012" },
        },
      },
    });

    await generateGatewayPaymentReceipt("pay_1", db as never);
    const html = (renderReceiptHtmlToPdfBuffer as jest.Mock).mock.calls[0][0] as string;
    expect(html).toContain("Onboarding Business Sdn Bhd");
    expect(html).not.toContain("Org Name Fallback Sdn Bhd");
    expect(html).toContain("Registration No.");
    expect(html).toContain("202201012345");
    expect(html).not.toContain("Unique ID");
    expect(html).not.toContain("IVT-202608-C01");
  });

  it("does not use org.name for receipt company when businessName is missing", async () => {
    const db = createDbMock({
      payment: {
        id: "pay_1",
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        status: GatewayPaymentStatus.COMPLETED,
        amount: { toNumber: () => 100 },
        currency: "MYR",
        method: "fpx",
        payer_name: "FPX PAYER",
        curlec_payment_id: "pay_curlec_1",
        curlec_order_id: "order_1",
        updated_at: new Date("2026-08-03T02:00:00.000Z"),
        metadata: null,
        issuer_organization: null,
        application: null,
        investor_organization: {
          id: "inv_1",
          type: OrganizationType.COMPANY,
          name: "Malcan Ventures Sdn Bhd",
          registration_number: null,
          first_name: null,
          middle_name: null,
          last_name: null,
          phone_number: "012",
          legal_name_on_id: null,
          corporate_onboarding_data: { basicInfo: {} },
          owner: { email: "inv@example.com", phone: "012" },
        },
      },
    });

    await generateGatewayPaymentReceipt("pay_1", db as never);
    const html = (renderReceiptHtmlToPdfBuffer as jest.Mock).mock.calls[0][0] as string;
    expect(html).not.toContain("Malcan Ventures Sdn Bhd");
    expect(html).not.toContain(">Company<");
  });

  it("keeps personal investor receipt company name empty", async () => {
    const db = createDbMock({
      payment: {
        id: "pay_1",
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        status: GatewayPaymentStatus.COMPLETED,
        amount: { toNumber: () => 100 },
        currency: "MYR",
        method: "fpx",
        payer_name: "ALI BIN ABU",
        curlec_payment_id: "pay_curlec_1",
        curlec_order_id: "order_1",
        updated_at: new Date("2026-08-03T02:00:00.000Z"),
        metadata: null,
        issuer_organization: null,
        application: null,
        investor_organization: {
          id: "inv_1",
          type: OrganizationType.PERSONAL,
          name: "Display Name",
          display_reference: "IVT-202608-A12",
          registration_number: null,
          first_name: "Ali",
          middle_name: null,
          last_name: "Abu",
          phone_number: "012",
          legal_name_on_id: "Ali Bin Abu",
          corporate_onboarding_data: null,
          owner: { email: "inv@example.com", phone: "012" },
        },
      },
    });

    await generateGatewayPaymentReceipt("pay_1", db as never);
    const html = (renderReceiptHtmlToPdfBuffer as jest.Mock).mock.calls[0][0] as string;
    expect(html).toContain("ALI BIN ABU");
    expect(html).not.toContain("Display Name");
    expect(html).not.toContain(">Company<");
    expect(html).toContain("Unique ID");
    expect(html).toContain("IVT-202608-A12");
    expect(html).not.toContain("inv_1");
    expect(html).not.toContain("Registration No.");
  });

  it("allows first PDF generation for a refunded receipt that never got a PDF", async () => {
    const db = createDbMock({
      payment: {
        id: "pay_1",
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: GatewayPaymentStatus.REFUNDED,
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
          corporate_onboarding_data: null,
          owner: { email: "issuer@example.com", phone: "012" },
        },
        application: null,
      },
      existingReceipt: {
        id: "rcp_1",
        receipt_number: "RCP-20260803-001",
        gateway_payment_id: "pay_1",
        payment_purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        purpose_label: "Issuer Registration Fee",
        status: GatewayPaymentReceiptStatus.REFUNDED,
        pdf_s3_key: null,
        merchant_snapshot: null,
        amount: { toNumber: () => 150 },
        currency: "MYR",
        payment_method: "fpx",
        payment_date: new Date("2026-08-03T02:00:00.000Z"),
        curlec_payment_id: "pay_curlec_1",
        curlec_order_id: "order_1",
        related_reference: "SSM-1",
        payer_name: null,
        payer_company_name: "Issuer Co",
        payer_email: null,
        payer_phone: null,
        wallet_credited: false,
        created_at: new Date("2026-08-03T02:00:00.000Z"),
      },
    });

    const result = await generateGatewayPaymentReceipt("pay_1", db as never);
    expect(result?.status).toBe(GatewayPaymentReceiptStatus.REFUNDED);
    expect(result?.pdf_s3_key).toBe("receipts/2026/08/RCP-20260803-001.pdf");
    expect(renderReceiptHtmlToPdfBuffer).toHaveBeenCalledTimes(1);
    const html = (renderReceiptHtmlToPdfBuffer as jest.Mock).mock.calls[0][0] as string;
    expect(html).toContain("Refunded");
  });
});
