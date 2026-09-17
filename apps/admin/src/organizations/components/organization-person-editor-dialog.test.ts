import type { ApplicationPersonRow } from "@cashsouk/types";
import { personToEditorValues } from "./organization-person-editor-dialog";

describe("personToEditorValues identityNumber provenance", () => {
  it("keeps identityNumber blank when canonical identityNumber is missing (even if matchKey looks like IC)", () => {
    const person: ApplicationPersonRow = {
      matchKey: "820508105871",
      identityNumber: null,
      name: "Ali",
      entityType: "INDIVIDUAL",
      roles: [],
      sharePercentage: null,
      status: "APPROVED",
    };

    const values = personToEditorValues(person);
    expect(values.identityNumber).toBe("");
  });
});

