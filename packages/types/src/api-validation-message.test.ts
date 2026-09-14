import {
  fieldErrorsFromApiDetails,
  humanizeApiValidationMessage,
  profileValidationErrorFromApi,
} from "./api-validation-message";

describe("humanizeApiValidationMessage", () => {
  it("CASE G: never shows responsiblePersonPhone to the user", () => {
    expect(humanizeApiValidationMessage("responsiblePersonPhone: Enter a valid phone number.")).toBe(
      "Enter a valid contact number."
    );
    expect(humanizeApiValidationMessage("responsiblePersonPhone is required")).toBe(
      "Contact Number is required."
    );
    expect(humanizeApiValidationMessage("responsiblePersonPhone: Contact Number is required.")).toBe(
      "Contact Number is required."
    );
  });

  it("strips other API field-path prefixes", () => {
    expect(humanizeApiValidationMessage("companyRegistrationNo: Enter a 12-digit Company Registration Number.")).toBe(
      "Enter a 12-digit Company Registration Number."
    );
    expect(humanizeApiValidationMessage("address.postalCode: Registered Address (Postcode) is required.")).toBe(
      "Registered Address (Postcode) is required."
    );
  });

  it("replaces technical Zod copy", () => {
    expect(humanizeApiValidationMessage("Invalid enum value. Expected 'MALE' | 'FEMALE'")).toBe(
      "Select a valid option."
    );
    expect(humanizeApiValidationMessage("Invalid email")).toBe("Enter a valid e-mail address.");
    expect(humanizeApiValidationMessage("Invalid phone number format")).toBe("Enter a valid phone number.");
  });

  it("maps Zod details onto field errors without property-name prefixes", () => {
    const fields = fieldErrorsFromApiDetails([
      { path: ["responsiblePersonPhone"], message: "Enter a valid phone number." },
      { path: ["address", "postalCode"], message: "Registered Address (Postcode) is required." },
    ]);
    expect(fields.responsiblePersonPhone).toBe("Enter a valid contact number.");
    expect(fields["address.postalCode"]).toBe("Registered Address (Postcode) is required.");
    const error = profileValidationErrorFromApi({
      message: "responsiblePersonPhone: Enter a valid phone number.",
      details: [{ path: ["responsiblePersonPhone"], message: "Enter a valid phone number." }],
    });
    expect(error.message).toBe("Enter a valid contact number.");
    expect(error.fieldErrors.responsiblePersonPhone).toBe("Enter a valid contact number.");
  });
});
