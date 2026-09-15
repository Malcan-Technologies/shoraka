import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("IssuerCompanySealCard", () => {
  const source = readFileSync(join(__dirname, "issuer-company-seal-card.tsx"), "utf8");

  it("loads the seal preview from an authorized endpoint rather than a raw S3 key", () => {
    expect(source).toContain("getIssuerCompanySealPreview");
    expect(source).toContain("issuer-company-seal-preview");
    expect(source).not.toContain("useS3ViewUrl");
    expect(source).not.toContain("seal.s3Key");
  });
});
