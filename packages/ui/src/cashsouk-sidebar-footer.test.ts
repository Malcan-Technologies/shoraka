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
  const linksSource = readFileSync(
    join(__dirname, "lib/compact-portal-legal-links.ts"),
    "utf8"
  );

  it("uses the shared availability-aware hook and opens PDFs via public API", () => {
    expect(footerSource).toContain("useCompactPortalLegalLinks");
    expect(footerSource).toContain("openPublicLegalPdf");
    expect(hookSource).toContain("/v1/public/legal-documents");
    expect(hookSource).toContain("buildCompactPortalLegalLinks");
    expect(linksSource).toContain("/v1/public/legal-documents/versions/");
    expect(linksSource).toContain("/view");
    expect(linksSource).toContain("/download");
  });

  it("does not navigate to /legal or /legal/[slug]", () => {
    expect(footerSource).not.toContain('"/legal"');
    expect(footerSource).not.toContain("/legal/");
    expect(footerSource).not.toContain("NEXT_PUBLIC_LANDING_URL");
    expect(footerSource).not.toContain("Legal Documents");
  });

  it("does not hard-code conditional legal paths in the footer component", () => {
    expect(footerSource).not.toContain("/legal/terms-of-use");
    expect(footerSource).not.toContain("/legal/pdpa-notice-and-consent");
    expect(footerSource).not.toContain("/legal/risk-statement");
  });
});
