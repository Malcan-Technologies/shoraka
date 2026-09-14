/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from "react-dom/server";
import { PROFILE_REQUIRED_EMPTY_LABEL } from "@cashsouk/types";
import { ProfileReadField } from "./profile-read-field";

describe("ProfileReadField required empty placeholder", () => {
  it("shows brand-red Please fill up for required empty fields", () => {
    const html = renderToStaticMarkup(
      <ProfileReadField label="Who are your main customers?" value="" required />
    );
    expect(html).toContain(PROFILE_REQUIRED_EMPTY_LABEL);
    expect(html).toContain("text-destructive");
    expect(html).not.toContain(">—<");
  });

  it("shows brand-red Please fill up for empty Company Activities", () => {
    const html = renderToStaticMarkup(
      <ProfileReadField label="Company Activities" value="   " required multiline />
    );
    expect(html).toContain(PROFILE_REQUIRED_EMPTY_LABEL);
    expect(html).toContain("text-destructive");
  });

  it("treats an em dash as empty when the field is required", () => {
    const html = renderToStaticMarkup(
      <ProfileReadField label="Date of Incorporation" value="—" required />
    );
    expect(html).toContain(PROFILE_REQUIRED_EMPTY_LABEL);
  });

  it("renders the filled required value without Please fill up", () => {
    const html = renderToStaticMarkup(
      <ProfileReadField label="Company Activities" value="Invoice financing" required />
    );
    expect(html).toContain("Invoice financing");
    expect(html).not.toContain(PROFILE_REQUIRED_EMPTY_LABEL);
    expect(html).not.toContain("text-destructive");
  });

  it("keeps the em dash for optional empty fields", () => {
    const html = renderToStaticMarkup(
      <ProfileReadField label="Which accounting software does the issuer use?" value="" />
    );
    expect(html).toContain("—");
    expect(html).not.toContain(PROFILE_REQUIRED_EMPTY_LABEL);
    expect(html).not.toContain("text-destructive");
  });

  it("does not render a required asterisk", () => {
    const html = renderToStaticMarkup(
      <ProfileReadField label="Type of Company" value="" required />
    );
    expect(html).not.toContain("*");
  });
});
