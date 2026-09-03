import { readFileSync } from "fs";
import { join } from "path";

describe("admin organization profile router permissions", () => {
  const source = readFileSync(join(__dirname, "controller.ts"), "utf8");

  it("requires organizations.manage for master writes", () => {
    expect(source).toContain('router.patch("/:portal/:id/master-profile", requirePermission("organizations.manage")');
    expect(source).toContain(
      'router.patch("/:portal/:id/party-profiles/:partyId", requirePermission("organizations.manage")'
    );
    expect(source).toContain("resolve-mismatch\", requirePermission(\"organizations.manage\")");
    expect(source).toContain("/adopt\", requirePermission(\"organizations.manage\")");
    expect(source).toContain("/inactivate\", requirePermission(\"organizations.manage\")");
    expect(source).toContain('router.patch("/:portal/:id/financials", requirePermission("organizations.manage")');
  });

  it("audits material admin writes", () => {
    expect(source).toContain("MASTER_PROFILE_UPDATED");
    expect(source).toContain("MASTER_PARTY_UPDATED");
    expect(source).toContain("MASTER_PARTY_MISMATCH_RESOLVED");
    expect(source).toContain("MASTER_PARTY_ADOPTED");
    expect(source).toContain("MASTER_PARTY_INACTIVATED");
    expect(source).toContain("MASTER_PARTY_CREATED");
    expect(source).toContain("MASTER_FINANCIALS_UPDATED");
  });
});
