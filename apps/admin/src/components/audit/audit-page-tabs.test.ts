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

  it("switches External Acceptances with the same query-param Tabs control as Legal Acceptances", () => {
    expect(source).toContain("value={activeTab}");
    expect(source).toContain("onValueChange={handleTabChange}");
    expect(source).toContain("router.replace(`${pathname}?tab=${value}`)");
    expect(source).toContain('id: "legal-acceptances"');
    expect(source).toContain('id: "external-acceptances"');
    expect(source).not.toContain("/audit/external-acceptances");
  });

  it("keeps the Audit tab strip above panel content so a closed drawer cannot swallow tab clicks", () => {
    expect(source).toContain(
      'className="relative z-20 flex h-auto w-fit max-w-full flex-wrap justify-start"'
    );
  });
});
