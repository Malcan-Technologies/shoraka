import { readFileSync } from "fs";
import { join } from "path";
import {
  contactDetailsSaveError,
  personalDetailsSaveError,
  residentialAddressSaveError,
} from "./profile-section-validation";

const profilePage = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("investor profile section save validation", () => {
  it("lets Personal Details save with blank State and Postcode", () => {
    expect(
      personalDetailsSaveError({
        gender: "MALE",
        nationality: "Malaysia",
        dateOfBirth: "1989-11-14",
      })
    ).toBeNull();
  });

  it("still requires personal fields when saving Personal Details", () => {
    expect(
      personalDetailsSaveError({
        gender: "",
        nationality: "Malaysia",
        dateOfBirth: "1989-11-14",
      })
    ).toMatch(/Gender/i);
    expect(
      personalDetailsSaveError({
        gender: "FEMALE",
        nationality: "Malaysia",
        dateOfBirth: "",
      })
    ).toBe("Enter a valid Date of Birth.");
  });

  it("requires State only on Residential Address save", () => {
    expect(residentialAddressSaveError({ state: "", postalCode: "" })).toBe("State is required.");
    expect(residentialAddressSaveError({ state: "Selangor", postalCode: "47800" })).toBeNull();
  });

  it("validates phone only on Contact details save", () => {
    expect(contactDetailsSaveError("+60123456789")).toBeNull();
    expect(contactDetailsSaveError("not-a-phone")).toBe("Enter a valid phone number.");
    expect(contactDetailsSaveError(undefined)).toBeNull();
  });

  it("scopes investor profile Save to the card being edited", () => {
    const personalCall = profilePage.slice(
      profilePage.indexOf("personalDetailsSaveError({"),
      profilePage.indexOf("if (personalError)")
    );
    expect(personalCall).toContain("personalDetailsSaveError({");
    expect(personalCall).not.toContain("residentialState");
    expect(personalCall).not.toContain("postalCode");
    expect(profilePage).toContain("residentialAddressSaveError({");
    expect(profilePage).toContain("contactDetailsSaveError(phoneNumber)");
    expect(profilePage).not.toContain("if (phoneNumber && !isValidProfilePhone(phoneNumber))");
  });
});
