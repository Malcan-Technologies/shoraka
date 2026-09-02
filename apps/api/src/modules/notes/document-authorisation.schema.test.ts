import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  documentAuthorisationConfigSchema,
  requestDocumentStampUploadUrlSchema,
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
  it("accepts supported stamp uploads", () => {
    expect(
      requestDocumentStampUploadUrlSchema.parse({
        purpose: "CERTIFICATE_COMPANY_STAMP",
        fileName: "stamp.png",
        contentType: "image/png",
        fileSize: 1024,
      }).purpose
    ).toBe("CERTIFICATE_COMPANY_STAMP");
  });

  it("rejects oversized files", () => {
    expect(
      requestDocumentStampUploadUrlSchema.safeParse({
        purpose: "RECEIPT_COMPANY_STAMP",
        fileName: "stamp.png",
        contentType: "image/png",
        fileSize: 6 * 1024 * 1024,
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
  });
});
