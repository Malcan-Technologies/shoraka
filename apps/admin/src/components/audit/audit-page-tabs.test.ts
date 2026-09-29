import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AdminPermission } from "@cashsouk/types";
import {
  AUDIT_PERMISSIONS,
  AUDIT_TABS,
  getVisibleAuditTabs,
  resolveActiveAuditTab,
} from "../../lib/audit-tabs";

function canWith(...granted: AdminPermission[]) {
  return (permission: AdminPermission) => granted.includes(permission);
}

function visibleIds(...granted: AdminPermission[]) {
  return getVisibleAuditTabs(canWith(...granted)).map((tab) => tab.id);
}

describe("Admin Audit page hosts evidence views", () => {
  const source = readFileSync(join(__dirname, "../../app/audit/page.tsx"), "utf8");

  it("lists the operational evidence tabs in order", () => {
    expect(AUDIT_TABS.map((tab) => tab.id)).toEqual([
      "access",
      "security",
      "products",
      "legal-documents",
      "legal-acceptances",
      "external-acceptances",
      "notifications",
    ]);
  });

  it("reuses the existing evidence panels", () => {
    expect(source).toContain("LegalAcceptancesPanel");
    expect(source).toContain("LegalExternalAcceptancesPanel");
    expect(source).toContain("NotificationLogsPanel");
  });

  it("switches External Acceptances with the same query-param Tabs control as Legal Acceptances", () => {
    expect(source).toContain("value={activeTab}");
    expect(source).toContain("onValueChange={handleTabChange}");
    expect(source).toContain("router.replace(`${pathname}?tab=${value}`)");
    expect(source).toContain('tab.id === "legal-acceptances"');
    expect(source).toContain('tab.id === "external-acceptances"');
    expect(source).not.toContain("/audit/external-acceptances");
  });

  it("keeps the Audit tab strip above panel content so a closed drawer cannot swallow tab clicks", () => {
    expect(source).toContain(
      'className="relative z-20 flex h-auto w-fit max-w-full flex-wrap justify-start"'
    );
  });
});

describe("Audit tab permissions", () => {
  it("gives every tab its own audit permission", () => {
    expect(Object.fromEntries(AUDIT_TABS.map((tab) => [tab.id, tab.permission]))).toEqual({
      access: "audit.access.view",
      security: "audit.security.view",
      products: "audit.product.view",
      "legal-documents": "audit.legal_documents.view",
      "legal-acceptances": "audit.legal_acceptances.view",
      "external-acceptances": "audit.external_acceptances.view",
      notifications: "audit.notifications.view",
    });
    expect(new Set(AUDIT_PERMISSIONS).size).toBe(AUDIT_TABS.length);
  });

  it.each(AUDIT_TABS.map((tab) => [tab.permission, tab.id] as const))(
    "%s shows only the %s tab",
    (permission, id) => {
      expect(visibleIds(permission)).toEqual([id]);
    }
  );

  it("does not show Audit tabs for document_management.view or notifications.view", () => {
    expect(
      visibleIds(
        "document_management.view",
        "document_management.manage",
        "notifications.view",
        "notifications.manage"
      )
    ).toEqual([]);
  });

  it("shows no tabs without audit permissions", () => {
    expect(visibleIds()).toEqual([]);
    expect(resolveActiveAuditTab(getVisibleAuditTabs(canWith()), "access")).toBeUndefined();
  });

  it("gates the page and tabs with the same permission list", () => {
    const page = readFileSync(join(__dirname, "../../app/audit/page.tsx"), "utf8");
    expect(page).toContain("getVisibleAuditTabs(can)");
    expect(page).toContain("if (!canAny(...AUDIT_PERMISSIONS) || !activeTab) {");
    expect(page).toContain("<AccessDeniedCard />");
    expect(page).not.toContain("document_management.view");
    expect(page).not.toContain("notifications.view");
  });
});

describe("Audit default tab", () => {
  const tabs = getVisibleAuditTabs(
    canWith("audit.product.view", "audit.legal_acceptances.view", "audit.notifications.view")
  );

  it("defaults to the first allowed tab", () => {
    expect(resolveActiveAuditTab(tabs, null)).toBe("products");
  });

  it("keeps a requested tab the user is allowed to see", () => {
    expect(resolveActiveAuditTab(tabs, "notifications")).toBe("notifications");
  });

  it("falls back to the first allowed tab when the requested tab is not allowed or unknown", () => {
    expect(resolveActiveAuditTab(tabs, "access")).toBe("products");
    expect(resolveActiveAuditTab(tabs, "legal-documents")).toBe("products");
    expect(resolveActiveAuditTab(tabs, "nope")).toBe("products");
  });
});
