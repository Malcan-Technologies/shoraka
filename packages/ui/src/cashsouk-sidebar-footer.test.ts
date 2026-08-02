import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("portal compact legal sidebar links", () => {
  const footerSource = readFileSync(
    join(__dirname, "cashsouk-sidebar-footer.tsx"),
    "utf8"
  );

  it("links Terms of Use, PDPA, Risk Statement and Legal Documents to landing URLs", () => {
    expect(footerSource).toContain("/legal/terms-of-use");
    expect(footerSource).toContain("/legal/pdpa-notice-and-consent");
    expect(footerSource).toContain("/legal/risk-statement");
    expect(footerSource).toContain('href: "/legal"');
    expect(footerSource).toContain("NEXT_PUBLIC_LANDING_URL");
  });
});
