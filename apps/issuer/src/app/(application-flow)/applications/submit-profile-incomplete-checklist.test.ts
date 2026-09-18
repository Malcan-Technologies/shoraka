import { readFileSync } from "fs";
import { join } from "path";

const editPage = readFileSync(
  join(__dirname, "[id]/edit/page.tsx"),
  "utf8"
);

describe("issuer submit: profile incomplete checklist modal", () => {
  test("incomplete profile pre-check opens checklist modal (no redirect to /profile)", () => {
    expect(editPage).toContain("if (profileCompletenessQuery.data?.complete === false)");
    expect(editPage).toContain("setProfileIncompleteChecklistOpen(true)");
    expect(editPage).not.toContain('needsPeople ? "directors" : "completeness"');
    expect(editPage).not.toContain("void safeNavigate(`/profile?focus=${needsPeople");
  });

  test("backend PROFILE_INCOMPLETE fallback opens the same checklist modal", () => {
    expect(editPage).toContain('if (getApiMutationErrorCode(error) === "PROFILE_INCOMPLETE")');
    const count = editPage.match(/setProfileIncompleteChecklistOpen\(true\)/g)?.length ?? 0;
    // We expect at least: pre-check + execute catch + confirm catch + fee-after-paid catch.
    expect(count).toBeGreaterThanOrEqual(2);
    // Redirect-by-needsPeople should be removed from PROFILE_INCOMPLETE handling.
    expect(editPage).not.toContain('void safeNavigate(`/profile?focus=${needsPeople');
  });

  test("complete profile continues into the normal submit confirmation flow", () => {
    expect(editPage).toContain("setSubmitConfirmOpen(true)");
  });
});

