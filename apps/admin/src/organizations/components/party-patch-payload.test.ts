import { buildPartyPatchPayloadFromEditorValues } from "./party-patch-payload";
import type { PartyEditorValues } from "./organization-person-editor-dialog";

function makeValues(overrides: Partial<PartyEditorValues>): PartyEditorValues {
  return {
    name: "Alice",
    salutation: "Mr",
    identityPrefix: "NRIC",
    identityNumber: "S1234567A",
    entityType: "INDIVIDUAL",
    isDirector: false,
    isShareholder: false,
    isBoard: false,
    isManagement: false,
    gender: "MALE",
    nationality: "MALAYSIA",
    countryOfIncorporation: "",
    dateOfBirth: "1990-01-01",
    dateOfIncorporation: "",
    line1: "1 Road",
    line2: "",
    state: "Johor",
    postalCode: "80000",
    shareholdingPercentage: "10",
    shareType: "ORDINARY",
    shareTypeOther: "",
    shareholdingUnits: "1",
    shareholdingAmount: "1000",
    designation: "OTHERS",
    designationOther: "CEO",
    appointmentDate: "2020-01-01",
    resignationDate: "",
    email: "alice@example.com",
    ...overrides,
  };
}

describe("buildPartyPatchPayloadFromEditorValues", () => {
  it("individual (director + shareholder) patch payload omits corporate-only keys", () => {
    const values = makeValues({
      entityType: "INDIVIDUAL",
      isDirector: true,
      isShareholder: true,
      isBoard: false,
      isManagement: false,
      gender: "MALE",
      nationality: "MALAYSIA",
      dateOfBirth: "1990-01-01",
      // Ensure corporate-only fields are blank in the editor
      dateOfIncorporation: "",
      countryOfIncorporation: "",
    });

    const payload = buildPartyPatchPayloadFromEditorValues(values);

    expect(payload).not.toHaveProperty("entityType");
    expect(payload).not.toHaveProperty("dateOfIncorporation");
    expect(payload).not.toHaveProperty("countryOfIncorporation");
    expect(payload).not.toHaveProperty("designation");
    expect(payload).not.toHaveProperty("appointmentDate");
    expect(payload).toHaveProperty("dateOfBirth");
    expect(payload).toHaveProperty("shareType");
    expect(payload).toHaveProperty("shareholdingPercentage");
  });

  it("corporate patch payload omits personal-only keys and includes incorporation + share fields", () => {
    const values = makeValues({
      entityType: "CORPORATE",
      isShareholder: true,
      isDirector: false,
      isBoard: false,
      isManagement: false,
      dateOfBirth: "",
      dateOfIncorporation: "2000-01-01",
      countryOfIncorporation: "MY",
      gender: "NOT_APPLICABLE",
    });

    const payload = buildPartyPatchPayloadFromEditorValues(values);

    expect(payload).not.toHaveProperty("entityType");
    expect(payload).not.toHaveProperty("dateOfBirth");
    expect(payload).not.toHaveProperty("nationality");
    expect(payload).toHaveProperty("dateOfIncorporation");
    expect(payload).toHaveProperty("countryOfIncorporation");
    expect(payload.gender).toBe("NOT_APPLICABLE");
    expect(payload).toHaveProperty("shareType");
    expect(payload).toHaveProperty("shareholdingPercentage");

    // Corporate should not require officer fields from this editor.
    expect(payload).not.toHaveProperty("designation");
    expect(payload).not.toHaveProperty("appointmentDate");
  });

  it("omits Person Email when the lifecycle lock disables that field", () => {
    const payload = buildPartyPatchPayloadFromEditorValues(
      makeValues({ email: "legacy@example.com" }),
      { includeEmail: false }
    );

    expect(payload).not.toHaveProperty("email");
  });
});

