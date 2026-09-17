import { readFileSync } from "fs";
import { join } from "path";

const card = readFileSync(join(__dirname, "issuer-company-seal-card.tsx"), "utf8");

describe("Issuer company seal admin card", () => {
  it("uses the existing issuer company seal endpoints", () => {
    expect(card).toContain("getIssuerCompanySeal");
    expect(card).toContain("getIssuerCompanySealPreview");
    expect(card).toContain("requestIssuerCompanySealUploadUrl");
    expect(card).toContain("confirmIssuerCompanySeal");
    expect(card).toContain("deleteIssuerCompanySeal");
  });

  it("gates manage actions by org ownership or ORGANIZATION_ADMIN membership", () => {
    expect(card).toContain("ORGANIZATION_ADMIN");
    expect(card).toContain("org.owner.userId");
    expect(card).toContain("org.members.find");
  });
});

