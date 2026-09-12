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
    const identity = readFileSync(join(__dirname, "paymaster-identity-card.tsx"), "utf8");
    expect(detail).toContain("PaymasterVerificationCard");
    expect(card).toContain("PaymasterVerificationPanel");
    expect(card).toContain("Internal Paymaster identity review");
    expect(identity).toContain("Edit Paymaster Details");
    expect(identity).toContain("PaymasterOfficialIdentityDialog");
    expect(detail).not.toMatch(/Keep existing identity/i);
    expect(detail).not.toMatch(/Data review/i);
    expect(panel).toContain("Verified by");
    expect(panel).toContain("Verified at");
    expect(panel).toContain("Verify Paymaster");
    expect(panel).toContain("PaymasterOfficialIdentityDialog");
    expect(panel).not.toContain("paymasterIdentityToVerify");
    expect(panel).not.toContain("PAYMASTER_SUBMITTED_IDENTITIES_CONFLICT_MESSAGE");
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
    expect(linked).toContain('value: "issuers"');
    expect(linked).toContain('value: "applications"');
    expect(linked).toContain('value: "facilities"');
    expect(linked).toContain('value: "notes"');
    expect(linked).toMatch(
      /value: "issuers"[\s\S]*value: "applications"[\s\S]*value: "facilities"[\s\S]*value: "notes"/
    );
    expect(linked).toContain("uniquePaymasterApplicationCount");
    expect(linked).toContain("paymasterApplicationReviewHref");
    expect(linked).toContain("No applications yet.");
    expect(linked).toContain("No facilities yet.");
    expect(linked).toContain("No notes yet.");
    expect(linked).toContain("No issuer links yet.");
    expect(notices).toContain('title="Assignment notices"');
    expect(activity).toContain('title="Activity"');
    expect(activity).toContain("AdminVerticalTimeline");
    expect(activity).toContain("formatAuditEventLabel");
    expect(activity).toContain("events.map");
    expect(activity).toContain("orgHref");
    expect(activity).toContain("applicationHref");
    expect(activity).toMatch(
      /created, linked, identity-updated, identity-verified, and identity-synced/
    );
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
    expect(timeline).toMatch(/PAYMASTER_IDENTITY_UPDATED:\s*"Paymaster Identity Updated"/);
    expect(timeline).toMatch(/PAYMASTER_VERIFIED:\s*"Paymaster Identity Verified"/);
    expect(timeline).toMatch(/PAYMASTER_IDENTITY_SYNCED:\s*"Paymaster Identity Synced"/);
    expect(timeline).toMatch(/PAYMASTER_IDENTITY_RESOLVED:\s*"Paymaster Identity Resolved"/);
  });

  it("Application Review retains Verify Paymaster without mismatch warning", () => {
    const customer = readFileSync(
      join(__dirname, "../../components/application-review/sections/customer-section.tsx"),
      "utf8"
    );
    const customerFields = readFileSync(
      join(__dirname, "../../components/application-review/sections/customer-review-fields.tsx"),
      "utf8"
    );
    const contract = readFileSync(
      join(__dirname, "../../components/application-review/sections/contract-section.tsx"),
      "utf8"
    );
    const contractFields = readFileSync(
      join(__dirname, "../../components/application-review/sections/contract-review-fields.tsx"),
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
    expect(customerFields).toContain("Paymaster Verification");
    expect(contractFields).toContain("Paymaster Verification");
    expect(customerFields).toContain("SubmittedVerifiedPaymasterIdentity");
    expect(contractFields).toContain("SubmittedVerifiedPaymasterIdentity");
    expect(comparison).toContain("Current Paymaster Details");
    expect(comparison).toContain("Official Paymaster Identity");
    expect(comparison).not.toContain("Originally submitted by issuer");
    expect(comparison).toContain("Request Amendment");
    expect(comparison).not.toContain("Use Verified Paymaster Details");
    expect(comparison).not.toContain("useVerifiedDisabled");
    expect(customer).not.toContain("useVerifiedDisabled");
    expect(contract).not.toContain("useVerifiedDisabled");
    expect(customerFields).not.toContain("useVerifiedDisabled");
    expect(contractFields).not.toContain("useVerifiedDisabled");
    expect(customer).not.toMatch(/showMismatchBanner/);
    expect(contract).not.toMatch(/showMismatchBanner/);
    expect(customerFields).not.toMatch(/showMismatchBanner/);
    expect(contractFields).not.toMatch(/showMismatchBanner/);
    expect(panel).toContain("Verify Paymaster");
    expect(panel).toContain("applicationId");
    expect(panel).toContain("PaymasterOfficialIdentityDialog");
    expect(panel).not.toContain("paymasterIdentityToVerify");
    expect(panel).not.toContain("Paymaster Identity to Verify");
    const reviewPage = readFileSync(
      join(__dirname, "../../app/applications/[productKey]/[id]/page.tsx"),
      "utf8"
    );
    expect(reviewPage).toContain("isPaymasterSwitchingFrozen");
    expect(reviewPage).toContain("paymasterSwitchingFrozen");
    const sectionLock = readFileSync(
      join(
        __dirname,
        "../../components/application-review/offer-acceptance/resolve-section-action-lock.ts"
      ),
      "utf8"
    );
    expect(sectionLock).toContain(
      "Paymaster cannot be changed after a commercial offer or signed facility"
    );
  });

  it("keeps SSM read-only on Edit Paymaster and Verify Paymaster", () => {
    const fields = readFileSync(
      join(__dirname, "paymaster-official-identity-fields.tsx"),
      "utf8"
    );
    const dialog = readFileSync(
      join(__dirname, "paymaster-official-identity-dialog.tsx"),
      "utf8"
    );
    expect(fields).toContain('id="paymaster-official-ssm"');
    expect(fields).toMatch(/id="paymaster-official-ssm"[\s\S]*disabled[\s\S]*readOnly/);
    expect(dialog).toContain("SSM cannot be changed");
    expect(dialog).not.toMatch(/registrationNumber:\s*value\.registrationNumber/);
    const countryOptions = readFileSync(
      join(__dirname, "../utils/paymaster-country-options.ts"),
      "utf8"
    );
    expect(countryOptions).not.toMatch(/supportedValuesOf\(\s*["']region["']\s*\)/);
    expect(fields).toContain("value.country || undefined");
    expect(fields).toContain("value.entityType || undefined");
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
    expect(detail).toContain('label="Linked issuers"');
    expect(detail).toContain('label="Financings"');
    expect(detail).toContain('label="Notices"');
    expect(detail).not.toContain('label="Applications"');
    expect(identity).toContain("Official verified identity for this SSM");
    expect(identity).toContain("Admin-managed official identity for this SSM");
    expect(identity).toContain("Verification status");
    expect(identity).toContain("Verified by");
    expect(identity).toContain("Verified at");
    expect(submitted).toContain("Submitted Application Identities");
    expect(submitted).toContain("not separate Paymaster records");
    expect(submitted).toContain("View");
    expect(submitted).toContain("paymasterApplicationReviewHref");
    expect(submitted).toContain("No submitted application identities available yet.");
    expect(submitted).not.toMatch(/if \(identities\.length === 0\) return null/);
    expect(submitted).not.toMatch(/PaymasterMismatch/);
    expect(submitted).not.toMatch(/sendTyped|NotificationService/);
  });
});
