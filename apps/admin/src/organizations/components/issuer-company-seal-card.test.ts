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

  it("gates view/manage actions via organizations.view/manage permissions", () => {
    expect(card).toContain("ORGANIZATION_ADMIN");
    expect(card).toContain("org.owner.userId");
    expect(card).toContain("org.members.find");
    expect(card).toContain('can("organizations.view")');
    expect(card).toContain('can("organizations.manage")');
  });
});

