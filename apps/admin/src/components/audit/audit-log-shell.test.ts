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
  "legal-acceptances-panel.tsx",
  "notification-logs-panel.tsx",
];

const TOOLBAR_FILES = [
  "../access-logs-toolbar.tsx",
  "product-logs-panel.tsx",
  "legal-document-audit-panel.tsx",
  "legal-acceptances-panel.tsx",
  "notification-logs-panel.tsx",
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
    expect(read("legal-acceptances-panel.tsx")).toContain("AuditLogTableShell");
    expect(read("notification-logs-panel.tsx")).toContain("AuditLogTableShell");
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
    expect(read("legal-acceptances-panel.tsx")).toContain(
      "<AuditLogHead>Timestamp</AuditLogHead>"
    );
    expect(read("legal-acceptances-panel.tsx")).not.toContain("Accepted at");
    expect(read("legal-acceptances-panel.tsx")).not.toContain("Accepted by");
    expect(read("../access-logs-toolbar.tsx")).toContain("AuditLogDateRangeOptions");
    expect(read("product-logs-panel.tsx")).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(read("legal-document-audit-panel.tsx")).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(read("legal-acceptances-panel.tsx")).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(read("notification-logs-panel.tsx")).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(read("../access-log-table-row.tsx")).toContain("AUDIT_IP_CELL_CLASS");
    expect(read("product-logs-panel.tsx")).toContain("AUDIT_IP_CELL_CLASS");
    expect(read("legal-document-audit-panel.tsx")).toContain("AUDIT_IP_CELL_CLASS");
    expect(read("legal-acceptances-panel.tsx")).toContain("AUDIT_IP_CELL_CLASS");
    expect(read("../access-logs-table.tsx")).toContain('<AuditLogHead align="right">Actions</AuditLogHead>');
  });

  it("disables Export when the filtered result count is 0", () => {
    expect(read("../access-logs-export-button.tsx")).toContain("disabled={isExporting || disabled}");
    expect(read("../access-logs-toolbar.tsx")).toContain("disabled={filteredCount === 0}");
    expect(read("product-logs-panel.tsx")).toContain("disabled={totalCount === 0}");
    expect(read("legal-document-audit-panel.tsx")).toContain("disabled={exporting || totalCount === 0}");
    expect(read("legal-acceptances-panel.tsx")).toContain("disabled={exporting || totalCount === 0}");
    expect(read("notification-logs-panel.tsx")).toContain(
      "disabled={exportingLogs || (paginationLogs?.total ?? 0) === 0}"
    );
  });

  it("uses search placeholders that match searchable fields", () => {
    expect(read("../access-logs-toolbar.tsx")).toContain(
      'searchPlaceholder="Search by user name, email, or User ID..."'
    );
    expect(read("product-logs-panel.tsx")).toContain(
      'searchPlaceholder="Search by product name, actor, email, or product ID..."'
    );
    expect(read("legal-document-audit-panel.tsx")).toContain(
      'searchPlaceholder="Search by actor, document type, or document ID..."'
    );
    expect(read("legal-acceptances-panel.tsx")).toContain(
      'searchPlaceholder="Search by user, email, organisation, or document..."'
    );
    expect(read("notification-logs-panel.tsx")).toContain(
      'searchPlaceholder="Search by title, message, type, or admin..."'
    );
  });
});
