import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyAuditExportHeaders } from "../../lib/audit/export-headers";
import { AUDIT_EXPORT_LIMIT } from "../../lib/audit/order";

const srcRoot = join(__dirname, "../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

describe("audit export consistency", () => {
  it("sets truncation headers when the export cap is reached", () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader: (key: string, value: string) => {
        headers.set(key, value);
      },
    };
    applyAuditExportHeaders(res as never, AUDIT_EXPORT_LIMIT);
    expect(headers.get("X-Audit-Export-Limit")).toBe(String(AUDIT_EXPORT_LIMIT));
    expect(headers.get("X-Audit-Export-Truncated")).toBe("true");
  });

  it("does not mark a short export as truncated", () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader: (key: string, value: string) => {
        headers.set(key, value);
      },
    };
    applyAuditExportHeaders(res as never, 12);
    expect(headers.get("X-Audit-Export-Truncated")).toBeUndefined();
  });

  it("keeps Access, Security, Onboarding, Product, and Legal exports permission-gated", () => {
    expect(readSrc("modules/admin/controller.ts")).toContain(
      'requirePermission("audit.access.view")'
    );
    expect(readSrc("modules/admin/controller.ts")).toContain(
      'requirePermission("audit.security.view")'
    );
    expect(readSrc("modules/admin/controller.ts")).toContain('requirePermission("onboarding.view")');
    expect(readSrc("modules/products/log/controller.ts")).toContain(
      'requirePermission("audit.product.view")'
    );
    expect(readSrc("modules/legal-documents/audit-admin-controller.ts")).toContain(
      'requirePermission("document_management.view")'
    );
  });

  it("escapes CSV quotes and exports Legal JSON as a raw array", () => {
    const access = readSrc("modules/admin/controller.ts");
    expect(access).toContain('.replace(/"/g, \'""\')');
    const legal = readSrc("modules/legal-documents/audit-admin-controller.ts");
    expect(legal).toContain('.replace(/"/g, \'""\')');
    expect(legal).toContain("res.json(rows)");
    expect(legal).not.toContain("data: { logs: rows }");
  });

  it("applies the current request filters to every export reader", () => {
    expect(readSrc("modules/admin/controller.ts")).toContain("exportAccessLogs(filterParams)");
    expect(readSrc("modules/admin/controller.ts")).toContain("exportSecurityLogs(filterParams)");
    expect(readSrc("modules/admin/controller.ts")).toContain("exportOnboardingLogs(filterParams)");
    expect(readSrc("modules/products/log/controller.ts")).toContain("exportProductLogs({");
    expect(readSrc("modules/legal-documents/audit-admin-controller.ts")).toContain(
      "legalDocumentAuditAdminService.export(validated)"
    );
  });
});
