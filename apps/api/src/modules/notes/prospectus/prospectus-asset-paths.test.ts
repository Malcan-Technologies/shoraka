import { existsSync } from "node:fs";
import { resolveProspectusAssetAbsolutePath } from "./prospectus-asset-paths";
import { resolveProspectusOfficialLogoAbsolutePath } from "./prospectus-header-logo";
import { resolveProspectusShariahBadgeAbsolutePath } from "./prospectus-shariah-badge";
import { resolveProspectusRiskShieldAbsolutePath } from "./prospectus-risk-shield";
import {
  buildProspectusBrandMarkHtml,
  getProspectusOfficialLogoDataUri,
} from "./prospectus-header-logo";
import {
  buildProspectusShariahBadgeHtml,
  getProspectusShariahBadgeDataUri,
} from "./prospectus-shariah-badge";

describe("prospectus asset paths (API-packaged SVGs)", () => {
  it("resolves logo, Shariah badge, and risk shield from API assets", () => {
    const logo = resolveProspectusAssetAbsolutePath("logo.svg");
    const badge = resolveProspectusAssetAbsolutePath("prospectus-shariah-badge.svg");
    const shield = resolveProspectusAssetAbsolutePath("prospectus-risk-shield.svg");

    expect(logo).toBeTruthy();
    expect(badge).toBeTruthy();
    expect(shield).toBeTruthy();
    expect(existsSync(logo!)).toBe(true);
    expect(existsSync(badge!)).toBe(true);
    expect(existsSync(shield!)).toBe(true);
    expect(logo).toMatch(/assets[/\\]prospectus[/\\]logo\.svg$/);
  });

  it("embeds logo and Shariah badge as data URIs (not placeholders)", () => {
    expect(resolveProspectusOfficialLogoAbsolutePath()).toBeTruthy();
    expect(resolveProspectusShariahBadgeAbsolutePath()).toBeTruthy();
    expect(resolveProspectusRiskShieldAbsolutePath()).toBeTruthy();

    const logoUri = getProspectusOfficialLogoDataUri();
    const badgeUri = getProspectusShariahBadgeDataUri();
    expect(logoUri).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(badgeUri).toMatch(/^data:image\/svg\+xml;base64,/);

    const brandHtml = buildProspectusBrandMarkHtml();
    const badgeHtml = buildProspectusShariahBadgeHtml();
    expect(brandHtml).toContain('class="brand-logo"');
    expect(brandHtml).not.toContain("brand-mark-placeholder");
    expect(badgeHtml).toContain('class="shariah-badge"');
    expect(badgeHtml).toContain("data:image/svg+xml;base64,");
  });
});
