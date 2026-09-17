import fs from "node:fs";
import path from "node:path";

describe("IssuerAuthorizedRepresentativesCard", () => {
  it("exposes a single-choice Applies company seal control that can be cleared", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "issuer-authorized-representatives-card.tsx"),
      "utf8"
    );
    expect(source).toContain("showSealApplier");
    expect(source).toContain("sealApplierMatchKey");
    expect(source).toContain("onSealApplierChange");
    expect(source).toContain("RadioGroup");
    expect(source).toContain("Applies company seal");
    expect(source).toContain("PROFILE_COMPANY_SEAL_HREF");
    expect(source).toContain("ISSUER_COMPANY_SEAL_OWNER_ADMIN_REQUIRED_MESSAGE");
    expect(source).toContain("sealStatus");
    expect(source).not.toContain("lucide-react");
  });
});
