import * as fs from "fs";
import * as path from "path";

describe("application detail hero", () => {
  it("uses the shared entity hero with status tint and page-level review actions", () => {
    const pageSource = fs.readFileSync(
      path.join(__dirname, "../app/applications/[productKey]/[id]/page.tsx"),
      "utf8"
    );
    const heroSource = fs.readFileSync(
      path.join(__dirname, "application-detail-hero.tsx"),
      "utf8"
    );
    expect(pageSource).toContain("ApplicationDetailHero");
    expect(heroSource).toContain('variant="hero"');
    expect(heroSource).toContain("getAdminStatusToken(status)");
    expect(heroSource).toContain("Requested facility");
    expect(heroSource).toContain("AdminProductIdentity");
    expect(heroSource).toContain("productImageS3Key");
    expect(heroSource).toContain('variant="outline"');
    expect(heroSource).toContain('variant="destructive"');
  });
});
