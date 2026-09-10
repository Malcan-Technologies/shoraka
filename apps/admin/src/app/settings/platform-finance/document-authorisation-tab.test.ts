import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "./page.tsx"), "utf8");

describe("Platform Finance Document Authorisation tab", () => {
  it("no longer hosts authorised signatory name or company stamp configuration", () => {
    expect(page).not.toContain('value="document-authorisation"');
    expect(page).not.toContain("Authorised Signatory Name");
    expect(page).not.toContain("Save Document Authorisation");
    expect(page).not.toContain("requestPlatformFinanceDocumentStampUploadUrl");
    expect(page).not.toContain("CERTIFICATE_COMPANY_STAMP");
    expect(page).not.toContain("RECEIPT_COMPANY_STAMP");
    expect(page).not.toContain("Use same company stamp as Islamic Investment Note Certificate");
    expect(page).not.toContain("documentAuthorisationConfig");
    expect(page).not.toContain("validateCompanyStampFile");
  });

  it("still lets Admin upload the trustee letter authorised signature", () => {
    expect(page).toContain("handleSignatureFileChange");
    expect(page).toContain("COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE");
    expect(page).toContain("Save Trustee Letter");
  });
});
