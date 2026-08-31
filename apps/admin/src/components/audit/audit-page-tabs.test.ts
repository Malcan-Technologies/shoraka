import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Audit page hosts evidence views", () => {
  const source = readFileSync(join(__dirname, "../../app/audit/page.tsx"), "utf8");

  it("lists the operational evidence tabs in order", () => {
    const ids = [...source.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual([
      "access",
      "security",
      "products",
      "legal-documents",
      "legal-acceptances",
      "external-acceptances",
      "notifications",
    ]);
  });

  it("reuses the existing evidence panels and keeps per-tab permissions", () => {
    expect(source).toContain("LegalAcceptancesPanel");
    expect(source).toContain("LegalExternalAcceptancesPanel");
    expect(source).toContain("NotificationLogsPanel");
    expect(source).toContain('permission: "document_management.view"');
    expect(source).toContain('permission: "notifications.view"');
  });
});
