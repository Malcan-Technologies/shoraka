import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(
  join(__dirname, "organization-profile-panel.tsx"),
  "utf8"
);

describe("Admin Personal investor edit: completeness requiredness wording", () => {
  it("marks completeness-required fields as `required` (never Optional) in edit mode", () => {
    // Completeness-required fields must not render the "Optional" marker.
    // Implementation detail: ComRepFieldLabel shows "Optional" only when required=false.
    expect(panel).toMatch(/label=\{PROFILE_LABEL\.fullName\}[\s\S]*required/);
    expect(panel).toMatch(/label="Gender"[\s\S]*disabled=\{isRegTankLockedGender\}[\s\S]*required/);
    expect(panel).toMatch(
      /label=\{PROFILE_LABEL\.nationality\}[\s\S]*disabled=\{isRegTankLockedNationality\}[\s\S]*required/
    );

    // Identity Number / DOB must be required by completeness, not "currently missing".
    expect(panel).not.toContain('required={identityNumberRequiredMissing}');
    expect(panel).not.toContain('required={requiredFieldKeys.has("dateOfBirth")}');
  });

  it("keeps postcode conditional requiredness: optional only when State is Outside Malaysia", () => {
    expect(panel).toContain(
      'required={draft.residentialState !== "Outside Malaysia"}'
    );
    // State must always be required for completeness.
    expect(panel).toMatch(/label=\{PROFILE_ADDRESS_FIELD_LABELS\.state\}[\s\S]*required/);
  });

  it("does not alter enabled/disabled/editable state decisions", () => {
    // Editability is driven by provenance lock flags / ternaries, not requiredness props.
    expect(panel).toContain("identityNumberEditable ? (");
    expect(panel).toContain("disabled={isRegTankLockedGender}");
    expect(panel).toContain("disabled={isRegTankLockedNationality}");
    expect(panel).toContain("disabled={isRegTankLockedDateOfBirth}");
  });
});

