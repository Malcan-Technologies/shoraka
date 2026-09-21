import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("landing OAuth callback cookie parsing", () => {
  const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

  it("parses cookies from the first `=` via the shared helper", () => {
    expect(source).toContain("parseCookieHeader");
    expect(source).not.toContain('cookie.trim().split("=")');
  });
});
