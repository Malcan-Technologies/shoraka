import { AUDIT_PERMISSIONS, AUDIT_TABS, formatAuditEventLabel, isAuditTabId } from "./audit-tabs";

describe("admin audit tabs", () => {
  it("defines the six agreed global audit tabs in order", () => {
    expect(AUDIT_TABS.map((tab) => tab.id)).toEqual([
      "access",
      "security",
      "onboarding",
      "products",
      "legal-documents",
      "notifications",
    ]);
    expect(AUDIT_TABS.map((tab) => tab.label)).toEqual([
      "Access",
      "Security",
      "Onboarding",
      "Product",
      "Legal Documents",
      "Notifications",
    ]);
  });

  it("keeps each tab behind the existing permission for that audit source", () => {
    expect(AUDIT_TABS).toEqual([
      { id: "access", label: "Access", permission: "audit.access.view" },
      { id: "security", label: "Security", permission: "audit.security.view" },
      { id: "onboarding", label: "Onboarding", permission: "onboarding.view" },
      { id: "products", label: "Product", permission: "audit.product.view" },
      { id: "legal-documents", label: "Legal Documents", permission: "document_management.view" },
      { id: "notifications", label: "Notifications", permission: "notifications.view" },
    ]);
    expect(AUDIT_PERMISSIONS).toEqual(AUDIT_TABS.map((tab) => tab.permission));
  });

  it("accepts only known tab query values", () => {
    expect(isAuditTabId("access")).toBe(true);
    expect(isAuditTabId("products")).toBe(true);
    expect(isAuditTabId("onboarding")).toBe(true);
    expect(isAuditTabId("notifications")).toBe(true);
    expect(isAuditTabId("application")).toBe(false);
    expect(isAuditTabId("notes")).toBe(false);
    expect(isAuditTabId("payment")).toBe(false);
    expect(isAuditTabId(null)).toBe(false);
  });

  it("formats catalogue event names for display without changing the stored type", () => {
    expect(formatAuditEventLabel("USER_LOGGED_IN")).toBe("User Logged In");
    expect(formatAuditEventLabel("PRODUCT_UPDATED")).toBe("Product Updated");
  });
});
