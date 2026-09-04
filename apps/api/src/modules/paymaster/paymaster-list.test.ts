import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin Paymaster registry list", () => {
  it("returns the same linked counts as Paymaster Detail summary cards", () => {
    const src = readFileSync(join(__dirname, "service.ts"), "utf8");
    expect(src).toMatch(/linkedFacilityCount: row\._count\.contracts/);
    expect(src).toMatch(/linkedNoteCount: row\._count\.notes/);
    expect(src).toMatch(/noticeCount: row\._count\.assignment_notices/);
    expect(src).toMatch(/latestIssuerName: row\.issuer_links\[0\]\?\.issuer_organization\.name/);
    expect(src).toMatch(/contracts: \{ where: realFacilityContractWhere\(\) \}/);
    expect(src).toMatch(/assignment_notices: true/);
    expect(src).toMatch(/filter\(\(contract\) => !isStandaloneHolderContract\(contract\)\)/);
    expect(src).toMatch(/applications: collectLinkedPaymasterApplications\(row\.contracts\)/);
  });

  it("derives submitted application identities from linked contract customer_details", () => {
    const src = readFileSync(join(__dirname, "service.ts"), "utf8");
    expect(src).toMatch(/customer_details: true/);
    expect(src).toMatch(/originating_application:/);
    expect(src).toMatch(/applications: collectLinkedPaymasterApplications/);
    expect(src).toMatch(/submittedApplicationIdentities:/);
    expect(src).toMatch(/selectSubmittedApplicationIdentities/);
    expect(src).not.toMatch(/selectDifferingSubmittedApplicationIdentities/);
    expect(src).not.toMatch(/PaymasterMismatch/);
  });

  it("does not expose linked applications or submitted identities on issuer Paymaster list", () => {
    const src = readFileSync(join(__dirname, "service.ts"), "utf8");
    const issuerStart = src.indexOf("export async function listIssuerPaymasters");
    const issuerEnd = src.indexOf("export async function listAdminPaymasters");
    const issuerFn = src.slice(issuerStart, issuerEnd);
    expect(issuerFn).toMatch(/IssuerPaymasterOption/);
    expect(issuerFn).not.toMatch(/submittedApplicationIdentities/);
    expect(issuerFn).not.toMatch(/collectLinkedPaymasterApplications/);
    expect(issuerFn).not.toContain("applications:");
  });

  it("does not introduce a new Paymaster identity notification or audit event", () => {
    const service = readFileSync(join(__dirname, "service.ts"), "utf8");
    const identities = readFileSync(join(__dirname, "submitted-application-identities.ts"), "utf8");
    expect(service).not.toMatch(/sendTyped|NotificationService/);
    expect(identities).not.toMatch(/sendTyped|NotificationService/);
    expect(identities).not.toMatch(/PAYMASTER_CREATED|PAYMASTER_LINKED_TO_ISSUER|PAYMASTER_VERIFIED|PAYMASTER_IDENTITY_RESOLVED/);
    expect(identities).not.toMatch(/PaymasterMismatch/);
  });
});
