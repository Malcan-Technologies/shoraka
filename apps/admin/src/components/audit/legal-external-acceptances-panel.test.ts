import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("External Acceptances Admin presentation", () => {
  const panel = read("legal-external-acceptances-panel.tsx");
  const sheet = read("../legal-external-acceptance-detail-sheet.tsx");
  const hook = read("../../hooks/use-legal-external-acceptances.ts");

  it("follows the Legal Acceptances Audit shell", () => {
    expect(panel).toContain("AuditLogTableShell");
    expect(panel).toContain("AuditLogFilters");
    expect(panel).toContain("AuditLogEmptyRow");
    expect(panel).toContain("AuditLogViewDetailsButton");
    expect(panel).toContain("AUDIT_LOG_PAGE_SIZE");
    expect(panel).toContain("auditRecordCountLabel");
    expect(panel).toContain("disabled={exporting || totalCount === 0}");
    expect(panel).toContain("<AuditLogHead>Timestamp</AuditLogHead>");
    expect(panel).toContain("<AuditLogHead>Event</AuditLogHead>");
    expect(panel).toContain("<AuditLogHead>Party</AuditLogHead>");
    expect(panel).toContain('<AuditLogHead align="right">Actions</AuditLogHead>');
    expect(panel).not.toContain("<AuditLogHead>Accepted</AuditLogHead>");
    expect(panel).not.toContain("<AuditLogHead>Actor</AuditLogHead>");
    expect(panel).not.toContain("<AuditLogHead>Hash</AuditLogHead>");
    expect(panel).not.toContain("<AuditLogHead>Portal</AuditLogHead>");
  });

  it("wires list filters that the API already supports", () => {
    expect(panel).toContain("params.documentType");
    expect(panel).toContain("params.status");
    expect(panel).toContain("params.dateFrom");
    expect(panel).toContain("params.dateTo");
    expect(panel).not.toContain("params.audience");
    expect(panel).not.toContain("party_role");
    expect(hook).toContain('query.set("documentType"');
    expect(hook).toContain('query.set("status"');
    expect(hook).toContain('query.set("dateFrom"');
  });

  it("opens View details and shows masked IC only", () => {
    expect(panel).toContain("LegalExternalAcceptanceDetailSheet");
    expect(panel).toContain("openDetails");
    expect(sheet).toContain("partyIcMasked");
    expect(sheet).not.toContain("partyIcNumber");
    expect(hook).not.toContain("partyIcNumber");
  });

  it("keeps hash in the detail sheet and exports through the dedicated reader route", () => {
    expect(sheet).toContain('label="Hash"');
    expect(sheet).toContain("acceptance.documentHash");
    expect(hook).toContain("/v1/admin/legal-external-acceptances/export");
    expect(hook).toContain('format: "csv"');
  });

  it("uses a search placeholder that matches searchable fields", () => {
    expect(panel).toContain(
      'searchPlaceholder="Search by party, email, envelope, or application..."'
    );
  });
});
