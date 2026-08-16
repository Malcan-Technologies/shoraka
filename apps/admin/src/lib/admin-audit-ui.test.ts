import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("admin audit UI restructure", () => {
  const auditPage = read("app/audit/page.tsx");
  const sidebar = read("components/app-sidebar.tsx");
  const settingsNotifications = read("app/settings/notifications/page.tsx");

  it("renders the six audit panels from the shared tab config", () => {
    expect(auditPage).toContain('from "@/lib/audit-tabs"');
    expect(auditPage).toContain("setTitle(\"Audit Logs\")");
    expect(auditPage).toContain("<AccessLogsPanel />");
    expect(auditPage).toContain("<SecurityLogsPanel />");
    expect(auditPage).toContain("<OnboardingLogsPanel />");
    expect(auditPage).toContain("<ProductLogsPanel />");
    expect(auditPage).toContain("<LegalDocumentAuditPanel />");
    expect(auditPage).toContain("<NotificationLogsPanel />");
    expect(auditPage).toContain("router.replace(`${pathname}?tab=${activeTab}`)");
    expect(auditPage).not.toContain("ApplicationLogs");
    expect(auditPage).not.toContain("NoteLogs");
    expect(auditPage).not.toContain("PaymentLogs");
  });

  it("shows Audit Logs in the sidebar for every permission that can open a tab", () => {
    expect(sidebar).toContain("<span>Audit Logs</span>");
    expect(sidebar).toContain('tooltip="Audit Logs"');
    expect(sidebar).toContain("canViewOnboarding");
    expect(sidebar).toContain("canViewDocuments");
    expect(sidebar).toContain("canViewNotifications");
    expect(sidebar).toContain("canViewAuditAccess");
    expect(sidebar).toContain("canViewAuditSecurity");
    expect(sidebar).toContain("canViewAuditProduct");
  });

  it("relocates notification audit out of Settings management", () => {
    expect(settingsNotifications).toContain('href="/audit?tab=notifications"');
    expect(settingsNotifications).toContain("Audit Logs → Notifications");
    expect(settingsNotifications).toContain('includeLogs: false');
    expect(settingsNotifications).not.toContain('value="logs"');
    expect(settingsNotifications).not.toContain("Notification Logs");
    expect(settingsNotifications).toContain("Configuration");
    expect(settingsNotifications).toContain("Custom & Groups");
  });

  it("wires each global tab to the existing audit reader hook/API", () => {
    expect(read("components/audit/access-logs-panel.tsx")).toContain("useAccessLogs");
    expect(read("components/audit/security-logs-panel.tsx")).toContain("useSecurityLogs");
    expect(read("components/audit/onboarding-logs-panel.tsx")).toContain("useOnboardingLogs");
    expect(read("components/audit/onboarding-logs-panel.tsx")).toContain("OnboardingLogsExportButton");
    expect(read("components/audit/product-logs-panel.tsx")).toContain("useProductLogs");
    expect(read("components/audit/product-logs-panel.tsx")).toContain("useExportProductLogs");
    expect(read("components/audit/legal-document-audit-panel.tsx")).toContain(
      "useLegalDocumentAuditLogs"
    );
    expect(read("components/audit/notification-logs-panel.tsx")).toContain("useNotificationLogs");
    expect(read("hooks/use-notification-logs.ts")).toContain("getAdminNotificationLogs");
  });

  it("keeps Product export and adds inspectable metadata detail", () => {
    const productPanel = read("components/audit/product-logs-panel.tsx");
    expect(productPanel).toContain("handleExport");
    expect(productPanel).toContain("AuditLogDetailSheet");
    expect(productPanel).toContain("metadata: selectedLog.metadata");
  });

  it("does not add Application, Signing, Note, or Payment global audit tabs", () => {
    expect(read("app/audit/page.tsx")).not.toMatch(/tab\.id === "application"/);
    expect(read("lib/audit-tabs.ts")).not.toMatch(/application|signing|note|payment/i);
  });

  it("leaves contextual Application/Signing, Note, and Payment histories in place", () => {
    const applicationPage = read("app/applications/[productKey]/[id]/page.tsx");
    expect(applicationPage).toContain("RecentActivityCard");
    expect(read("hooks/use-application-logs.ts")).toContain("/v1/applications/");
    expect(read("hooks/use-application-logs.ts")).toContain("/logs");

    const notePage = read("app/notes/[id]/page.tsx");
    expect(notePage).toContain("NoteTimelinePanel");
    expect(read("notes/components/note-timeline-panel.tsx")).toContain("note.events");

    const paymentPage = read("app/finance/gateway-payments/[id]/page.tsx");
    expect(paymentPage).toContain("timelineEvents");
    expect(paymentPage).toContain("gatewayAuditEventView");
    expect(read("app/finance/gateway-payments/[id]/gateway-payment-copy.ts")).toContain(
      "Activity Timeline"
    );
  });

  it("keeps legacy audit path redirects", () => {
    expect(read("app/audit/access-logs/page.tsx")).toContain('redirect("/audit?tab=access")');
    expect(read("app/audit/security-logs/page.tsx")).toContain('redirect("/audit?tab=security")');
    expect(read("app/audit/product-logs/page.tsx")).toContain('redirect("/audit?tab=products")');
    expect(read("app/audit/onboarding-logs/page.tsx")).toContain(
      'redirect("/audit?tab=onboarding")'
    );
    expect(read("app/audit/notification-logs/page.tsx")).toContain(
      'redirect("/audit?tab=notifications")'
    );
  });
});
