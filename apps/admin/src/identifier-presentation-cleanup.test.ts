import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Identifier presentation cleanup (UI)", () => {
  it("audit drawer shows canonical target reference before internal target UUID", () => {
    const source = read("components/audit/audit-detail-drawer.tsx");
    const appRefIndex = source.indexOf('label: "Application reference"');
    const internalTargetIndex = source.indexOf('label: "Internal Target ID"');
    expect(appRefIndex).toBeGreaterThan(-1);
    expect(internalTargetIndex).toBeGreaterThan(appRefIndex);
  });

  it("user identity card uses Internal User ID label", () => {
    const source = read("accounts/components/user-account-identity-card.tsx");
    expect(source).toContain('label="Internal User ID"');
    expect(source).not.toContain('label="User ID"');
  });

  it("user profile panel shows Email before Internal User ID (presentation)", () => {
    const source = read("accounts/components/user-account-profile-panel.tsx");
    expect(source).toContain('label="Email"');
    expect(source).toContain('label="Internal User ID"');
    expect(source.indexOf('label="Email"')).toBeLessThan(source.indexOf('label="Internal User ID"'));
  });

  it("organization quick links shows owner email without appending owner UUID to display", () => {
    const source = read("organizations/components/organization-quick-links-card.tsx");
    expect(source).toContain('label="Owner account"');
    expect(source).toContain("ownerEmail");
    // display uses email + name, not the raw owner UUID
    expect(source).toContain("ownerName && ownerEmail");
    expect(source).not.toContain('display={ownerName ? ownerName : org.owner.userId}');
  });

  it("legal acceptance detail sheet moves internal IDs to Technical details", () => {
    const source = read("components/legal-acceptance-detail-sheet.tsx");
    expect(source).toContain("Technical details");
    expect(source).toContain('label="Internal Acceptance ID"');
    expect(source).toContain('label="Internal Legal Document ID"');
    expect(source).toContain('label="Internal Legal Document Version ID"');
    expect(source).toContain('label="Internal User ID"');
    expect(source).toContain('label="Internal Organisation ID"');

    // previously-primary technical identifiers removed from top-level overview
    expect(source).not.toContain('label="Acceptance ID"');
    expect(source).not.toContain('label="Version ID"');
    expect(source).not.toContain('label="Document ID"');
  });

  it("external acceptance detail sheet shows Application Reference + Envelope Title (business) and internal UUIDs (technical)", () => {
    const source = read("components/legal-external-acceptance-detail-sheet.tsx");
    expect(source).toContain("Application Reference");
    expect(source).toContain("Envelope Title");
    expect(source).toContain("Technical details");

    expect(source).toContain('label="Internal Acceptance ID"');
    expect(source).toContain('label="Internal Application ID"');
    expect(source).toContain('label="Internal Envelope ID"');
    expect(source).toContain('label="Internal Source ID"');

    expect(source).not.toContain('label="Acceptance ID"');
    expect(source).not.toContain('label="Source ID"');
    expect(source).not.toContain('label="Version ID"');
    expect(source).not.toContain('label="Document ID"');
  });
});

