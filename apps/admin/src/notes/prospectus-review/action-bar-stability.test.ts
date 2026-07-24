import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(__dirname, "../../app/notes/[id]/prospectus/page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");
const tabsSource = fs.readFileSync(path.join(__dirname, "working-area-tabs.tsx"), "utf8");
const sectionTitle = fs.readFileSync(path.join(__dirname, "section-title.tsx"), "utf8");

describe("prospectus action bar and tab status", () => {
  it("keeps the action bar always mounted (not gated on step === 3)", () => {
    expect(pageSource).toContain("data-prospectus-action-bar");
    expect(pageSource).not.toMatch(/actionBar\s*=\s*\n?\s*step === 3 \? null/);
    expect(pageSource).toContain("selectYearsFromPageTwoFinancialTable");
    expect(pageSource).toContain("saveStatusLabel");
    expect(pageSource).toContain("required fields missing");
  });

  it("uses a single dirty/save status in the action bar", () => {
    expect(pageSource).toContain("data-prospectus-dirty-state");
    expect(pageSource).toContain("All changes saved");
    expect(pageSource).toContain("Unsaved changes");
    expect(pageSource).toContain("Saving…");
  });

  it("Preview posts unsaved form values without Save Draft first", () => {
    expect(pageSource).toContain("onPreview");
    expect(pageSource).toContain("usePreviewProspectusReview");
    expect(pageSource).toContain("Live preview");
    expect(pageSource).toContain('"Preview"');
    expect(pageSource).not.toContain("Save & Preview");
    expect(pageSource).not.toContain("onSaveAndPreview");
    expect(pageSource).toContain("livePreview.mutateAsync");
    expect(pageSource).toContain("draftContent: draft");
    expect(pageSource).not.toMatch(/onPreview[\s\S]{0,400}setDirty\(false\)/);
  });

  it("Approve uses AlertDialog and never window.confirm", () => {
    expect(pageSource).toContain("AlertDialog");
    expect(pageSource).toContain("openApproveDialog");
    expect(pageSource).toContain("confirmApprove");
    expect(pageSource).toContain("getProspectusApproveConfirmCopy");
    expect(pageSource).not.toContain("window.confirm");
  });

  it("dirty Save & Approve saves first then approves without draftContent", () => {
    expect(pageSource).toContain("approveDialogDirty");
    expect(pageSource).toContain("setApprovePhase(\"saving\")");
    expect(pageSource).toContain("setApprovePhase(\"approving\")");
    expect(pageSource).toContain("expectedUpdatedAt: data.review.updatedAt");
    expect(pageSource).toContain("approve.mutateAsync(undefined)");
    expect(pageSource).not.toMatch(
      /approve\.mutateAsync\(\s*dirty\s*\?/
    );
    expect(pageSource).not.toMatch(
      /approve\.mutateAsync\(\s*\{\s*draftContent/
    );
  });

  it("keeps dirty on save failure during Save & Approve and uses in-flight guard", () => {
    expect(pageSource).toContain("approveInFlightRef");
    expect(pageSource).toContain("Save failed");
    expect(pageSource).toContain("Approve failed");
    // Conflict path during confirmApprove must not clear dirty.
    expect(pageSource).toMatch(
      /ProspectusReviewConflictError[\s\S]*?Refresh and try again[\s\S]*?void refetch\(\);[\s\S]*?return;/
    );
    const conflictBlock = pageSource.slice(
      pageSource.indexOf("confirmApprove"),
      pageSource.indexOf("if (isLoading || !data || !draft)")
    );
    expect(conflictBlock).toContain("ProspectusReviewConflictError");
    expect(conflictBlock).not.toMatch(
      /ProspectusReviewConflictError[\s\S]{0,200}setDirty\(false\)/
    );
  });

  it("renders Complete in green and missing in amber on tabs", () => {
    expect(tabsSource).toContain("text-emerald-700");
    expect(tabsSource).toContain("text-amber-700");
    expect(tabsSource).toContain("Optional");
    expect(sectionTitle).toContain("text-emerald-700");
    expect(sectionTitle).toContain("h-5 w-5 shrink-0 text-primary");
  });

  it("does not re-select Page 3 years from live Application alone", () => {
    expect(pageSource).not.toMatch(/useApplicationDetail/);
    expect(pageSource).not.toMatch(/selectPageThreeYears\(financialStatements\)/);
    expect(pageSource).toContain("frozenFinancialYears");
    expect(pageSource).toContain("financialComparison?.years");
  });
});
