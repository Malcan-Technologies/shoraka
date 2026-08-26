import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

const TABLE_FILES = [
  "../access-logs-table.tsx",
  "../access-log-table-row.tsx",
  "product-logs-panel.tsx",
  "legal-document-audit-panel.tsx",
  "../../app/legal-document-acceptances/page.tsx",
  "../../app/settings/notifications/page.tsx",
];

const TOOLBAR_FILES = [
  "../access-logs-toolbar.tsx",
  "product-logs-panel.tsx",
  "legal-document-audit-panel.tsx",
  "../../app/legal-document-acceptances/page.tsx",
  "../../app/settings/notifications/page.tsx",
];

describe("dedicated Admin log tables share one visual shell", () => {
  it("uses the shared table shell, empty state, and View details action", () => {
    for (const relativePath of TABLE_FILES) {
      const source = read(relativePath);
      expect(source).not.toContain("No logs found");
      expect(source).not.toContain(">View<");
      expect(source).not.toContain("Export CSV");
    }
    expect(read("../access-logs-table.tsx")).toContain("AuditLogTableShell");
    expect(read("../access-logs-table.tsx")).toContain("AuditLogEmptyRow");
    expect(read("../access-log-table-row.tsx")).toContain("AuditLogViewDetailsButton");
    expect(read("product-logs-panel.tsx")).toContain("AuditLogTableShell");
    expect(read("product-logs-panel.tsx")).toContain("AuditLogViewDetailsButton");
    expect(read("legal-document-audit-panel.tsx")).toContain("AuditLogTableShell");
    expect(read("../../app/legal-document-acceptances/page.tsx")).toContain("AuditLogTableShell");
    expect(read("../../app/settings/notifications/page.tsx")).toContain("AuditLogTableShell");
  });

  it("exposes a single Filters control rather than multiple filter buttons", () => {
    for (const relativePath of TOOLBAR_FILES) {
      const source = read(relativePath);
      expect(source).toContain("AuditLogFilters");
      expect(source).not.toContain('label="Type"');
      expect(source).not.toContain('label="Action"');
      expect(source).not.toContain('label="Portal"');
    }
  });

  it("keeps Actions last and uses Timestamp / Event / Actor labels", () => {
    expect(read("product-logs-panel.tsx")).toContain("<AuditLogHead>Timestamp</AuditLogHead>");
    expect(read("product-logs-panel.tsx")).toContain("<AuditLogHead>Event</AuditLogHead>");
    expect(read("product-logs-panel.tsx")).toContain("<AuditLogHead>Actor</AuditLogHead>");
    expect(read("legal-document-audit-panel.tsx")).toContain("<AuditLogHead>Actor</AuditLogHead>");
    expect(read("../../app/legal-document-acceptances/page.tsx")).toContain(
      "<AuditLogHead>Timestamp</AuditLogHead>"
    );
    expect(read("../../app/legal-document-acceptances/page.tsx")).not.toContain("Accepted at");
    expect(read("../../app/legal-document-acceptances/page.tsx")).not.toContain("Accepted by");
    expect(read("../access-logs-toolbar.tsx")).toContain("AuditLogDateRangeOptions");
    expect(read("product-logs-panel.tsx")).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(read("legal-document-audit-panel.tsx")).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(read("../../app/legal-document-acceptances/page.tsx")).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(read("../../app/settings/notifications/page.tsx")).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(read("../access-log-table-row.tsx")).toContain("AUDIT_IP_CELL_CLASS");
    expect(read("product-logs-panel.tsx")).toContain("AUDIT_IP_CELL_CLASS");
    expect(read("legal-document-audit-panel.tsx")).toContain("AUDIT_IP_CELL_CLASS");
    expect(read("../../app/legal-document-acceptances/page.tsx")).toContain("AUDIT_IP_CELL_CLASS");
    expect(read("../access-logs-table.tsx")).toContain('<AuditLogHead align="right">Actions</AuditLogHead>');
  });
});
