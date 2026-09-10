import { readFileSync } from "fs";
import { join } from "path";

describe("issuer /profile/complete", () => {
  const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

  it("stays redirect-only onto the normal Profile page", () => {
    expect(source).toContain('redirect("/profile?tab=people")');
    expect(source).toContain("redirect(`/profile?focus=${focus}`)");
    expect(source).not.toContain("use client");
    expect(source).not.toContain("stepper");
    expect(source).not.toContain("Wizard");
  });
});
