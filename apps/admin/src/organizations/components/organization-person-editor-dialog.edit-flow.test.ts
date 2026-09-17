import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(__dirname, "organization-person-editor-dialog.tsx"), "utf8");

describe("OrganizationPersonEditorDialog edit flow", () => {
  it("keeps Select components controlled (no `|| undefined` value props)", () => {
    expect(source).not.toContain("|| undefined");
  });

  it("on PATCH validation failure, sets only field errors (does not reset form values)", () => {
    const catchIdx = source.indexOf("catch (err)");
    expect(catchIdx).toBeGreaterThanOrEqual(0);

    // Grab a small region after `catch (err)` and assert it doesn't reset values.
    const window = source.slice(catchIdx, catchIdx + 400);
    expect(window).toContain("setFieldErrors");
    expect(window).not.toContain("setValues");
  });

  it("hydrates Person Email from the displayed master-or-legacy helper", () => {
    expect(source).toContain("displayedPersonEmail");
    expect(source).toContain("personEmail: extras?.personEmail");
    expect(source).toContain("PROFILE_LABEL.accountEmail");
    expect(source).toContain("emailLocked");
  });
});
