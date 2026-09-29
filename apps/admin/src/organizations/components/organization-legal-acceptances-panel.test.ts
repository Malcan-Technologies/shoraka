import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(__dirname, "../..", path), "utf8");

const organizationPanel = read("organizations/components/organization-legal-acceptances-panel.tsx");
const auditPanel = read("components/audit/legal-acceptances-panel.tsx");
const detailSheet = read("components/legal-acceptance-detail-sheet.tsx");
const hooks = read("hooks/use-legal-document-acceptances.ts");

/** Source of one exported hook, up to the next export. */
function hookSource(name: string): string {
  const start = hooks.indexOf(`export function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const end = hooks.indexOf("\nexport ", start + 1);
  return hooks.slice(start, end === -1 ? undefined : end);
}

describe("Organization detail Acceptances uses the organization-scoped routes", () => {
  it("lists through the organization hook, not the Audit hook", () => {
    expect(organizationPanel).toContain("useOrganizationLegalAcceptances(organizationScope, {");
    expect(organizationPanel).not.toMatch(/\buseLegalDocumentAcceptances\b/);
  });

  it("takes the organization from props and sends no organization or audience filter", () => {
    expect(organizationPanel).toContain("() => ({ portal, organizationId })");
    expect(organizationPanel).not.toContain("audience:");
  });

  it("opens details and downloads through the organization scope", () => {
    expect(organizationPanel).toContain("organizationScope={organizationScope}");
    expect(detailSheet).toContain("useOrganizationLegalAcceptanceDetail(");
    expect(detailSheet).toContain("downloadAcceptedVersion(acceptanceId, organizationScope)");
  });

  it("builds organization URLs from the scope", () => {
    expect(hooks).toContain(
      "`/v1/admin/organizations/${scope.portal}/${scope.organizationId}/legal-acceptances`"
    );
    expect(hookSource("useOrganizationLegalAcceptances")).toContain(
      "organizationAcceptancesPath(scope)"
    );
    expect(hookSource("useOrganizationLegalAcceptances")).not.toContain(
      "/v1/admin/legal-document-acceptances"
    );
    expect(hookSource("useOrganizationLegalAcceptanceDetail")).toContain(
      "`${organizationAcceptancesPath(scope)}/${id}`"
    );
    expect(hookSource("useOrganizationLegalAcceptanceDetail")).not.toContain(
      "/v1/admin/legal-document-acceptances"
    );
  });
});

describe("Organization detail Acceptances follows the page permission", () => {
  const detailPage = read("organizations/components/organization-detail-page.tsx");

  it("shows the tab with organizations.view, without document_management.view", () => {
    expect(detailPage).toContain('const canView = can("organizations.view");');
    expect(detailPage).toContain("const canViewAcceptances = canView;");
    expect(detailPage).not.toContain("document_management");
  });
});

describe("Audit Legal Acceptances keeps the Audit routes", () => {
  it("lists and exports through the Audit hooks", () => {
    expect(auditPanel).toMatch(/\buseLegalDocumentAcceptances\b/);
    expect(auditPanel).toContain("useExportLegalDocumentAcceptances");
    expect(auditPanel).not.toContain("useOrganizationLegalAcceptances");
  });

  it("opens details without an organization scope", () => {
    expect(auditPanel).toContain("<LegalAcceptanceDetailSheet");
    expect(auditPanel).not.toContain("organizationScope");
  });

  it("calls the Audit URLs", () => {
    expect(hookSource("useLegalDocumentAcceptances")).toContain(
      "`/v1/admin/legal-document-acceptances?${query.toString()}`"
    );
    expect(hookSource("useLegalDocumentAcceptanceDetail")).toContain(
      "`/v1/admin/legal-document-acceptances/${id}`"
    );
    expect(hookSource("useExportLegalDocumentAcceptances")).toContain(
      "/v1/admin/legal-document-acceptances/export?"
    );
    expect(hookSource("useDownloadAcceptedVersion")).toContain(
      ": `/v1/admin/legal-document-acceptances/${acceptanceId}/download`"
    );
  });
});
