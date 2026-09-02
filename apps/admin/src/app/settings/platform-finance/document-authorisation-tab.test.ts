import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "./page.tsx"), "utf8");

describe("Platform Finance Document Authorisation tab", () => {
  it("saves signatory name, stamps, and the use-same option", () => {
    expect(page).toContain('value="document-authorisation"');
    expect(page).toContain("Authorised Signatory Name");
    expect(page).toContain("Use same company stamp as Islamic Investment Note Certificate");
    expect(page).toContain("CERTIFICATE_COMPANY_STAMP");
    expect(page).toContain("RECEIPT_COMPANY_STAMP");
    expect(page).toContain("Save Document Authorisation");
    expect(page).toContain("requestPlatformFinanceDocumentStampUploadUrl");
    expect(page).toContain("documentAuthorisationConfig");
  });
});
