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

  it("reuses Activity Timeline onboarding titles, including A044 transitions", () => {
    expect(
      formatAuditEventLabel("ONBOARDING_STATUS_CHANGED", {
        previousStatus: "IN_PROGRESS",
        newStatus: "PENDING_SSM_REVIEW",
      })
    ).toBe("Verification Submitted");
    expect(
      formatAuditEventLabel("ONBOARDING_STATUS_CHANGED", {
        previousStatus: "PENDING",
        newStatus: "PENDING_APPROVAL",
      })
    ).toBe("Verification Submitted");
    expect(
      formatAuditEventLabel("ONBOARDING_STATUS_CHANGED", {
        previousStatus: "PENDING_SSM_REVIEW",
        newStatus: "PENDING_AMENDMENT",
      })
    ).toBe("Amendment Requested");
    expect(
      formatAuditEventLabel("ONBOARDING_STATUS_CHANGED", {
        previousStatus: "PENDING_AMENDMENT",
        newStatus: "PENDING_SSM_REVIEW",
      })
    ).toBe("Verification Resubmitted");
    expect(
      formatAuditEventLabel("ONBOARDING_STATUS_CHANGED", {
        previousStatus: "PENDING_APPROVAL",
        newStatus: "PENDING_AML",
      })
    ).toBe("Onboarding Stage Updated");
    expect(formatAuditEventLabel("ONBOARDING_STATUS_CHANGED")).not.toBe("Onboarding Status Changed");
    expect(
      formatAuditEventLabel("DIRECTOR_KYC_STATUS_UPDATED", { newKycStatus: "APPROVED" })
    ).toBe("Director Verification Approved");
    expect(
      formatAuditEventLabel("DIRECTOR_KYC_STATUS_UPDATED", { newKycStatus: "REJECTED" })
    ).toBe("Director Verification Rejected");
    expect(formatAuditEventLabel("ONBOARDING_STARTED")).toBe("Onboarding Started");
    expect(formatAuditEventLabel("AML_APPROVED")).toBe("AML Approved");
    expect(formatAuditEventLabel("SSM_APPROVED")).toBe("SSM Approved");
    expect(formatAuditEventLabel("ONBOARDING_RESUMED")).toBe("Onboarding Resumed");
    expect(formatAuditEventLabel("CORPORATE_ENTITIES_UPDATED")).toBe("Corporate Entities Updated");
  });
});
