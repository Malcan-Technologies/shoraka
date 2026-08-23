import fs from "node:fs";
import path from "node:path";

describe("Investor portal switch navigation", () => {
  const source = fs.readFileSync(path.join(__dirname, "nav-user.tsx"), "utf8");

  it("navigates to the Issuer origin and does not call switch-role", () => {
    expect(source).toMatch(/NEXT_PUBLIC_ISSUER_URL/);
    expect(source).toMatch(/window\.location\.href = ISSUER_URL/);
    expect(source).toMatch(/Switch to Issuer Portal/);
    expect(source).not.toMatch(/switch-role/);
    expect(source).not.toMatch(/switchRole/);
    expect(source).not.toMatch(/ACTIVE_ROLE_CHANGED/);
  });
});
