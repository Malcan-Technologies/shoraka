/**
 * Page-ownership RBAC: read-only panels use the owning page's view permission; actions keep their
 * manage permission.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

describe("Organization detail Activity tab", () => {
  it("reads onboarding logs through the organization-scoped route", () => {
    const hook = src("hooks/use-organization-logs.ts");
    const timeline = src("components/organization-activity-timeline.tsx");
    expect(hook).toContain("apiClient.getOrganizationOnboardingLogs(portal, organizationId, params)");
    expect(hook).not.toContain("apiClient.getOnboardingLogs(");
    expect(timeline).toContain("useOrganizationLogs(portal, organizationId)");
    expect(timeline).toContain("apiClient.getOrganizationOnboardingLogs(portal, organizationId, {");
    expect(timeline).not.toContain("apiClient.getOnboardingLogs(");
  });
});

describe("Note detail read-only panels", () => {
  it("Investors panel uses the note-scoped route", () => {
    const panel = src("notes/components/note-investors-panel.tsx");
    expect(panel).toContain("useAdminNoteInvestments(note.id, {");
    expect(panel).not.toContain("useAdminInvestments(");
  });

  it("Excess late charge history uses the note-scoped route; the gateway link needs gateway_payments.view", () => {
    const panel = src("notes/components/excess-late-charge-admin-panel.tsx");
    expect(panel).toContain("useNoteExcessLateChargePayments(noteId, { page: 1, pageSize: 20 })");
    expect(panel).not.toContain("useGatewayPayments(");
    expect(panel).toContain('const canOpenGatewayPayment = can("gateway_payments.view");');
    expect(panel).toMatch(/\{canOpenGatewayPayment \? \(\s*<Button asChild[\s\S]*?\/finance\/gateway-payments\//);
  });
});

describe("Onboarding Review and RegTank links", () => {
  it("Review opens with onboarding.view", () => {
    const row = src("components/onboarding-queue-row.tsx");
    expect(row).toContain('const canViewOnboarding = can("onboarding.view");');
    expect(row).toContain("disabled={!canViewOnboarding}");
    expect(row).not.toContain('can("onboarding.manage")');
  });

  it("RegTank view links use onboarding.view; actions stay on onboarding.manage", () => {
    const dialog = src("components/onboarding-review-dialog.tsx");
    expect(dialog).toContain('const canViewRegTank = can("onboarding.view");');
    expect(dialog).toContain('const canManage = can("onboarding.manage");');
    expect(dialog.match(/disabled=\{!application\.regtankPortalUrl \|\| !canViewRegTank\}/g)).toHaveLength(3);
    expect(dialog).toContain("const noPermission = !canViewRegTank;");
    expect(dialog).toMatch(/handleOpenRegTank = \(\) => \{\s*if \(!canViewRegTank\) return;/);
    expect(dialog).toMatch(/handleOpenKycReview = \(\) => \{\s*if \(!canViewRegTank\) return;/);
    expect(dialog).toContain("disabled={restartMutation.isPending || !canManage}");
  });
});

describe("Signing", () => {
  const panel = src("components/application-review/signing/signing-envelope-panel.tsx");
  const matrix = src("components/application-review/signing/signing-progress-matrix.tsx");

  it("loads readiness for every page viewer (applications.view)", () => {
    expect(panel).toContain("useAdminSigningPackageReadiness(applicationId);");
    expect(panel).not.toContain("useAdminSigningPackageReadiness(applicationId, canManage)");
  });

  it("gates auto-sign Retry on offer_acceptance.manage (canManage) and renders it disabled", () => {
    expect(panel).toMatch(/handleRetryAutoSign = async \([^)]*\) => \{\s*if \(!canManage\) return;/);
    expect(panel).toContain("retryDisabled={!canManage || retryAutoSignMutation.isPending}");
    expect(matrix).toContain("title={retryDisabled ? retryDisabledReason : undefined}");
  });
});

describe("Pending amendment Remove", () => {
  it("uses the row's section / item permission, not applications.manage", () => {
    const modal = src("components/application-review/amendment-review-modal.tsx");
    const page = src("app/applications/[productKey]/[id]/page.tsx");
    expect(modal).toContain(
      "canManageReviewSection(getSectionForPendingAmendment(item.scope, item.scope_key), can)"
    );
    expect(modal).toContain("disabled={pending || !canRemove}");
    expect(modal).toMatch(/onClick=\{\(\) => \{\s*if \(!canRemove\) return;/);
    expect(page).toMatch(/<AmendmentReviewModal[\s\S]*?can=\{can\}/);
  });
});
