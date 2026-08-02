import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("portal compact legal sidebar/footer wiring", () => {
  const footerSource = readFileSync(
    join(__dirname, "cashsouk-sidebar-footer.tsx"),
    "utf8"
  );
  const hookSource = readFileSync(
    join(__dirname, "hooks/use-compact-portal-legal-links.ts"),
    "utf8"
  );

  it("uses the shared availability-aware hook", () => {
    expect(footerSource).toContain("useCompactPortalLegalLinks");
    expect(hookSource).toContain("/v1/public/legal-documents");
    expect(hookSource).toContain("buildCompactPortalLegalLinks");
    expect(hookSource).toContain("permanentCompactPortalLegalLinks");
  });

  it("opens links on the landing origin", () => {
    expect(footerSource).toContain("NEXT_PUBLIC_LANDING_URL");
  });

  it("does not hard-code conditional legal paths in the footer component", () => {
    expect(footerSource).not.toContain("/legal/terms-of-use");
    expect(footerSource).not.toContain("/legal/pdpa-notice-and-consent");
    expect(footerSource).not.toContain("/legal/risk-statement");
  });
});
