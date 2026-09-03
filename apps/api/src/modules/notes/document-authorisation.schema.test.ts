import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  documentAuthorisationConfigSchema,
  requestDocumentStampUploadUrlSchema,
  requestTrusteeSignatureUploadUrlSchema,
  updatePlatformFinanceSettingsSchema,
} from "./schemas";

describe("documentAuthorisationConfig schema", () => {
  it("saves an authorised signatory name and shared stamp flag", () => {
    const parsed = documentAuthorisationConfigSchema.parse({
      authorisedSignatoryName: "Ahmad",
      useSameCompanyStamp: true,
    });
    expect(parsed.authorisedSignatoryName).toBe("Ahmad");
    expect(parsed.useSameCompanyStamp).toBe(true);
  });

  it("accepts certificate and separate receipt stamps", () => {
    const parsed = documentAuthorisationConfigSchema.parse({
      authorisedSignatoryName: "Sarah",
      useSameCompanyStamp: false,
      certificateCompanyStamp: {
        s3Key: "platform-finance/document-stamps/certificate/a.png",
        fileName: "a.png",
        contentType: "image/png",
      },
      receiptCompanyStamp: {
        s3Key: "platform-finance/document-stamps/receipt/b.png",
        fileName: "b.png",
        contentType: "image/jpeg",
      },
    });
    expect(parsed.useSameCompanyStamp).toBe(false);
    expect(parsed.certificateCompanyStamp?.s3Key).toContain("certificate");
    expect(parsed.receiptCompanyStamp?.s3Key).toContain("receipt");
  });

  it("defaults blank name and shared stamp when omitted", () => {
    const parsed = documentAuthorisationConfigSchema.parse({});
    expect(parsed.authorisedSignatoryName).toBe("");
    expect(parsed.useSameCompanyStamp).toBe(true);
  });

  it("rejects names over 200 characters and invalid stamp types", () => {
    expect(
      documentAuthorisationConfigSchema.safeParse({
        authorisedSignatoryName: "A".repeat(201),
      }).success
    ).toBe(false);
    expect(
      documentAuthorisationConfigSchema.safeParse({
        certificateCompanyStamp: { s3Key: "x", contentType: "application/pdf" },
      }).success
    ).toBe(false);
  });

  it("nests on platform finance settings update", () => {
    const parsed = updatePlatformFinanceSettingsSchema.parse({
      documentAuthorisationConfig: {
        authorisedSignatoryName: "Ahmad",
        useSameCompanyStamp: true,
      },
    });
    expect(parsed.documentAuthorisationConfig?.authorisedSignatoryName).toBe("Ahmad");
  });
});

describe("requestDocumentStampUploadUrlSchema", () => {
  it("accepts PNG, JPEG, JPG, and WEBP stamp uploads", () => {
    expect(
      requestDocumentStampUploadUrlSchema.parse({
        purpose: "CERTIFICATE_COMPANY_STAMP",
        fileName: "stamp.png",
        contentType: "image/png",
        fileSize: 1024,
      }).purpose
    ).toBe("CERTIFICATE_COMPANY_STAMP");
    expect(
      requestDocumentStampUploadUrlSchema.parse({
        purpose: "RECEIPT_COMPANY_STAMP",
        fileName: "stamp.jpg",
        contentType: "image/jpeg",
        fileSize: 2048,
      }).purpose
    ).toBe("RECEIPT_COMPANY_STAMP");
    expect(
      requestDocumentStampUploadUrlSchema.parse({
        purpose: "CERTIFICATE_COMPANY_STAMP",
        fileName: "stamp.jpg",
        contentType: "image/jpg",
        fileSize: 2048,
      }).contentType
    ).toBe("image/jpg");
    expect(
      requestDocumentStampUploadUrlSchema.parse({
        purpose: "CERTIFICATE_COMPANY_STAMP",
        fileName: "stamp.webp",
        contentType: "image/webp",
        fileSize: 2048,
      }).contentType
    ).toBe("image/webp");
  });

  it("accepts files at the 5 MB cap with no aspect or pixel-dimension fields", () => {
    const parsed = requestDocumentStampUploadUrlSchema.parse({
      purpose: "CERTIFICATE_COMPANY_STAMP",
      fileName: "wide-or-tall.png",
      contentType: "image/png",
      fileSize: 5 * 1024 * 1024,
    });
    expect(parsed.fileSize).toBe(5 * 1024 * 1024);
    expect(parsed).not.toHaveProperty("width");
    expect(parsed).not.toHaveProperty("height");
    expect(parsed).not.toHaveProperty("aspectRatio");
  });

  it("rejects oversized files with the company-stamp size message", () => {
    const parsed = requestDocumentStampUploadUrlSchema.safeParse({
      purpose: "RECEIPT_COMPANY_STAMP",
      fileName: "stamp.png",
      contentType: "image/png",
      fileSize: 6 * 1024 * 1024,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Company stamp image must be 5 MB or smaller.");
    }
  });

  it("rejects unsupported MIME types with the admin format message", () => {
    const parsed = requestDocumentStampUploadUrlSchema.safeParse({
      purpose: "CERTIFICATE_COMPANY_STAMP",
      fileName: "stamp.pdf",
      contentType: "application/pdf",
      fileSize: 1024,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Upload a PNG, JPG or WEBP image.");
    }
  });
});

describe("requestTrusteeSignatureUploadUrlSchema", () => {
  it("keeps the existing trustee MIME list and 5 MB cap", () => {
    expect(
      requestTrusteeSignatureUploadUrlSchema.parse({
        fileName: "sign.png",
        contentType: "image/png",
        fileSize: 5 * 1024 * 1024,
      }).fileSize
    ).toBe(5 * 1024 * 1024);
    expect(
      requestTrusteeSignatureUploadUrlSchema.safeParse({
        fileName: "sign.pdf",
        contentType: "application/pdf",
        fileSize: 1024,
      }).success
    ).toBe(false);
  });
});

describe("document authorisation permissions", () => {
  it("guards settings and stamp upload with platform_settings.manage", () => {
    const controller = readFileSync(join(__dirname, "controller.ts"), "utf8");
    const stampIdx = controller.indexOf('"/document-stamp/upload-url"');
    expect(stampIdx).toBeGreaterThan(0);
    expect(controller.slice(stampIdx - 80, stampIdx + 80)).toContain(
      'requirePermission("platform_settings.manage")'
    );
    expect(controller).not.toContain('"/document-stamp/confirm"');
  });
});
