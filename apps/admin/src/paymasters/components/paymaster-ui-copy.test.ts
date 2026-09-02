import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Paymaster UI copy after mismatch removal", () => {
  it("Registry has Verified/Unverified filters and no review-required mismatch state", () => {
    const source = readFileSync(join(__dirname, "../../app/paymasters/page.tsx"), "utf8");
    expect(source).toMatch(/label:\s*"Verified"/);
    expect(source).toMatch(/label:\s*"Unverified"/);
    expect(source).not.toMatch(/Review required/i);
    expect(source).not.toMatch(/mismatchPending|mismatch_pending/);
  });

  it("Registry table keeps verification status and drops mismatch columns", () => {
    const table = readFileSync(join(__dirname, "paymasters-table.tsx"), "utf8");
    const row = readFileSync(join(__dirname, "paymasters-table-row.tsx"), "utf8");
    expect(table).toContain('label="Status"');
    expect(table).toContain('label="Facilities"');
    expect(table).toContain('label="Notes"');
    expect(table).toContain('label="Notices"');
    expect(table).toContain("PaymastersTableRow");
    expect(row).toContain("paymasterVerificationLabel");
    expect(row).toContain("adminActionRowClass");
    expect(row).toContain("View");
    expect(table).not.toMatch(/Review required/i);
    expect(table).not.toMatch(/mismatch/i);
    expect(row).not.toMatch(/mismatch/i);
  });

  it("Paymaster Detail keeps verification status/by/at and has no mismatch section", () => {
    const detail = readFileSync(join(__dirname, "paymaster-detail-view.tsx"), "utf8");
    const card = readFileSync(join(__dirname, "paymaster-verification-card.tsx"), "utf8");
    const panel = readFileSync(join(__dirname, "paymaster-verification-panel.tsx"), "utf8");
    expect(detail).toContain("PaymasterVerificationCard");
    expect(card).toContain("PaymasterVerificationPanel");
    expect(card).toContain("Internal Paymaster identity review");
    expect(detail).not.toMatch(/Keep existing identity/i);
    expect(detail).not.toMatch(/Data review/i);
    expect(panel).toContain("Verified by");
    expect(panel).toContain("Verified at");
    expect(panel).toContain("Verify Paymaster");
    expect(panel).not.toMatch(/Customer details differ/i);
    expect(panel).not.toMatch(/Review Paymaster/);
    expect(panel).not.toMatch(/mismatch/i);
  });

  it("Paymaster Detail uses issuer-style tabs with identity Activity separate from Linked issuers and notices", () => {
    const detail = readFileSync(join(__dirname, "paymaster-detail-view.tsx"), "utf8");
    const linked = readFileSync(join(__dirname, "paymaster-linked-records-panel.tsx"), "utf8");
    const notices = readFileSync(join(__dirname, "paymaster-notices-card.tsx"), "utf8");
    const activity = readFileSync(join(__dirname, "paymaster-activity-panel.tsx"), "utf8");
    expect(detail).toContain("AdminDetailTabs");
    expect(detail).toContain("AdminRelatedRecordsRail");
    expect(detail).toContain('id: "identity"');
    expect(detail).toContain('id: "linked-records"');
    expect(detail).toContain('id: "activity"');
    expect(detail).toContain("PaymasterActivityPanel");
    expect(detail).toContain("PaymasterVerificationCard");
    expect(detail).toContain("PaymasterNoticesCard");
    expect(detail).toContain("PaymasterSubmittedIdentitiesCard");
    expect(linked).toContain('title="Linked records"');
    expect(linked).toContain("Issuers that have used this Paymaster");
    expect(notices).toContain('title="Assignment notices"');
    expect(activity).toContain('title="Activity"');
    expect(activity).toContain("AdminVerticalTimeline");
    expect(activity).toContain("formatAuditEventLabel");
    expect(activity).toContain("events.map");
    expect(activity).toContain("orgHref");
    expect(activity).toContain("applicationHref");
    expect(activity).toMatch(/created, issuer-link, and identity-verified/);
    expect(activity).not.toMatch(/PAYMASTER_NOTICE|acknowledgement|Notice of Assignment/i);
    expect(activity).not.toMatch(/sendTyped|NotificationService/);
  });

  it("Application Activity still presents the same Paymaster identity events", () => {
    const timeline = readFileSync(
      join(__dirname, "../../components/admin-activity-timeline.tsx"),
      "utf8"
    );
    expect(timeline).toMatch(/PAYMASTER_CREATED:\s*"Paymaster Created"/);
    expect(timeline).toMatch(/PAYMASTER_LINKED_TO_ISSUER:\s*"Paymaster Linked to Issuer"/);
    expect(timeline).toMatch(/PAYMASTER_VERIFIED:\s*"Paymaster Identity Verified"/);
    expect(timeline).toMatch(/PAYMASTER_IDENTITY_RESOLVED:\s*"Paymaster Identity Resolved"/);
  });

  it("Application Review retains Verify Paymaster without mismatch warning", () => {
    const customer = readFileSync(
      join(__dirname, "../../components/application-review/sections/customer-section.tsx"),
      "utf8"
    );
    const contract = readFileSync(
      join(__dirname, "../../components/application-review/sections/contract-section.tsx"),
      "utf8"
    );
    const comparison = readFileSync(
      join(
        __dirname,
        "../../components/application-review/paymaster-identity-comparison.tsx"
      ),
      "utf8"
    );
    const panel = readFileSync(join(__dirname, "paymaster-verification-panel.tsx"), "utf8");
    expect(customer).toContain("Paymaster Verification");
    expect(contract).toContain("Paymaster Verification");
    expect(customer).toContain("SubmittedVerifiedPaymasterIdentity");
    expect(contract).toContain("SubmittedVerifiedPaymasterIdentity");
    expect(comparison).toContain("Use Verified Paymaster");
    expect(comparison).toContain("Request Amendment");
    expect(customer).not.toMatch(/showMismatchBanner/);
    expect(contract).not.toMatch(/showMismatchBanner/);
    expect(panel).toContain("Verify Paymaster");
    expect(panel).toContain("applicationId");
  });

  it("Paymaster Detail Identity tab shows submitted application identities as Admin reference only", () => {
    const detail = readFileSync(join(__dirname, "paymaster-detail-view.tsx"), "utf8");
    const identity = readFileSync(join(__dirname, "paymaster-identity-card.tsx"), "utf8");
    const submitted = readFileSync(
      join(__dirname, "paymaster-submitted-identities-card.tsx"),
      "utf8"
    );
    expect(detail).toContain("PaymasterIdentityCard");
    expect(detail).toContain("PaymasterSubmittedIdentitiesCard");
    expect(detail).toContain("data.submittedApplicationIdentities");
    expect(identity).toContain("Official verified identity for this SSM");
    expect(identity).toContain("Current global Paymaster record");
    expect(identity).toContain("Verification status");
    expect(identity).toContain("Verified by");
    expect(identity).toContain("Verified at");
    expect(submitted).toContain("Submitted application identities");
    expect(submitted).toContain("not separate Paymaster records");
    expect(submitted).toContain("View");
    expect(submitted).toContain("applicationHref");
    expect(submitted).not.toMatch(/PaymasterMismatch/);
    expect(submitted).not.toMatch(/sendTyped|NotificationService/);
  });
});
