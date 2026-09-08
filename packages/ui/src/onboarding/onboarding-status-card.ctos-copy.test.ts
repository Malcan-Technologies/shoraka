import { readFileSync } from "fs";
import { join } from "path";

describe("onboarding status card CTOS empty copy", () => {
  const source = readFileSync(join(__dirname, "onboarding-status-card.tsx"), "utf8");

  it("names CTOS when the empty warning is from a CTOS refresh", () => {
    expect(source).toContain(
      "No directors or shareholders were found in the latest CTOS information."
    );
    expect(source).toContain("resolvedCtosEmptyWarning");
  });
});
