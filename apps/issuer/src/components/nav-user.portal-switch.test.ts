import fs from "node:fs";
import path from "node:path";

describe("Issuer portal switch navigation", () => {
  const source = fs.readFileSync(path.join(__dirname, "nav-user.tsx"), "utf8");

  it("navigates to the Investor origin and does not call switch-role", () => {
    expect(source).toMatch(/NEXT_PUBLIC_INVESTOR_URL/);
    expect(source).toMatch(/window\.location\.href = INVESTOR_URL/);
    expect(source).toMatch(/Switch to Investor Portal/);
    expect(source).not.toMatch(/switch-role/);
    expect(source).not.toMatch(/switchRole/);
    expect(source).not.toMatch(/ACTIVE_ROLE_CHANGED/);
  });
});
