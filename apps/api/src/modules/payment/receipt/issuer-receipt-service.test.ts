import { GatewayPaymentPurpose, GatewayPaymentReceiptStatus } from "@prisma/client";
import type { ActorContext } from "../deposit-service";
import { AppError } from "../../../lib/http/error-handler";
import {
  getIssuerApplicationProcessingFeeReceiptPdfUrl,
  getIssuerOnboardingFeeReceiptPdfUrl,
} from "./issuer-receipt-service";

jest.mock("../../../lib/s3/client", () => ({
  generatePresignedDownloadUrl: jest.fn(async () => ({
    downloadUrl: "https://example.com/download",
    expiresIn: 123,
  })),
  generatePresignedViewUrl: jest.fn(async () => ({
    viewUrl: "https://example.com/view",
    expiresIn: 456,
  })),
}));

function createDbMock(overrides: {
  payment?: unknown;
  issuerOrg?: unknown;
  application?: unknown;
  receipt?: unknown;
}) {
  return {
    gatewayPayment: {
      findFirst: jest.fn(async () => overrides.payment ?? null),
    },
    issuerOrganization: {
      findFirst: jest.fn(async () => overrides.issuerOrg ?? null),
    },
    application: {
      findFirst: jest.fn(async () => overrides.application ?? null),
    },
    gatewayPaymentReceipt: {
      findUnique: jest.fn(async () => overrides.receipt ?? null),
    },
  } as never;
}

describe("issuer receipt pdf presigning", () => {
  const actor: ActorContext = { userId: "issuer-owner" };

  describe("onboarding fee", () => {
    it("presigns existing PDF for view mode", async () => {
      const db = createDbMock({
        payment: { issuer_organization_id: "issuer_1" },
        issuerOrg: { id: "issuer_1" },
        receipt: {
          receipt_number: "RCP-1",
          pdf_s3_key: "receipts/2026/08/RCP-1.pdf",
          status: GatewayPaymentReceiptStatus.GENERATED,
        },
      });

      const res = await getIssuerOnboardingFeeReceiptPdfUrl(actor, "pay_1", "view", db as never);
      expect(res.url).toBe("https://example.com/view");
      expect(res.hasPdf).toBe(true);
      expect(res.receiptStatus).toBe(GatewayPaymentReceiptStatus.GENERATED);
    });

    it("returns url:null while receipt is pending", async () => {
      const db = createDbMock({
        payment: { issuer_organization_id: "issuer_1" },
        issuerOrg: { id: "issuer_1" },
        receipt: {
          receipt_number: "RCP-1",
          pdf_s3_key: null,
          status: GatewayPaymentReceiptStatus.PENDING,
        },
      });

      const res = await getIssuerOnboardingFeeReceiptPdfUrl(actor, "pay_1", "view", db as never);
      expect(res.url).toBeNull();
      expect(res.expiresIn).toBeNull();
      expect(res.hasPdf).toBe(false);
      expect(res.receiptStatus).toBe(GatewayPaymentReceiptStatus.PENDING);
    });

    it("blocks access for a different issuer (IDOR)", async () => {
      const db = createDbMock({
        payment: { issuer_organization_id: "issuer_1" },
        issuerOrg: null,
      });

      await expect(
        getIssuerOnboardingFeeReceiptPdfUrl(actor, "pay_1", "view", db as never)
      ).rejects.toMatchObject({ code: "ONBOARDING_FEE_NOT_FOUND" });
    });

    it("rejects unexpected purpose by treating it as not found", async () => {
      const db = createDbMock({
        payment: null, // service queries with purpose filter; simulate mismatch by returning null
      });

      await expect(
        getIssuerOnboardingFeeReceiptPdfUrl(actor, "pay_1", "view", db as never)
      ).rejects.toMatchObject({ code: "ONBOARDING_FEE_NOT_FOUND" });
    });
  });

  describe("application processing fee", () => {
    it("presigns existing PDF for download mode", async () => {
      const db = createDbMock({
        application: { id: "app_1" },
        payment: { id: "pay_1" },
        receipt: {
          receipt_number: "RCP-2",
          pdf_s3_key: "receipts/2026/08/RCP-2.pdf",
          status: GatewayPaymentReceiptStatus.GENERATED,
        },
      });

      const res = await getIssuerApplicationProcessingFeeReceiptPdfUrl(
        actor,
        "app_1",
        "pay_1",
        "download",
        db as never
      );
      expect(res.url).toBe("https://example.com/download");
      expect(res.hasPdf).toBe(true);
      expect(res.receiptStatus).toBe(GatewayPaymentReceiptStatus.GENERATED);
      expect(res.fileName).toBe("RCP-2.pdf");
    });

    it("returns url:null when pdf_s3_key is missing", async () => {
      const db = createDbMock({
        application: { id: "app_1" },
        payment: { id: "pay_1" },
        receipt: {
          receipt_number: "RCP-2",
          pdf_s3_key: null,
          status: GatewayPaymentReceiptStatus.PENDING,
        },
      });

      const res = await getIssuerApplicationProcessingFeeReceiptPdfUrl(
        actor,
        "app_1",
        "pay_1",
        "view",
        db as never
      );
      expect(res.url).toBeNull();
      expect(res.hasPdf).toBe(false);
      expect(res.receiptStatus).toBe(GatewayPaymentReceiptStatus.PENDING);
      expect(res.fileName).toBe("RCP-2.pdf");
    });

    it("blocks access for a different issuer (IDOR)", async () => {
      const db = createDbMock({
        application: null,
      });

      await expect(
        getIssuerApplicationProcessingFeeReceiptPdfUrl(
          actor,
          "app_1",
          "pay_1",
          "view",
          db as never
        )
      ).rejects.toMatchObject({ code: "PROCESSING_FEE_NOT_FOUND" });
    });

    it("rejects unexpected purpose by treating it as not found", async () => {
      const db = createDbMock({
        application: { id: "app_1" },
        payment: null, // simulate purpose mismatch / missing gateway payment
      });

      await expect(
        getIssuerApplicationProcessingFeeReceiptPdfUrl(
          actor,
          "app_1",
          "pay_1",
          "view",
          db as never
        )
      ).rejects.toMatchObject({ code: "PROCESSING_FEE_NOT_FOUND" });
    });
  });
});

