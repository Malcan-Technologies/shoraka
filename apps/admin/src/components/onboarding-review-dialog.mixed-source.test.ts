import { readFileSync } from "fs";
import { join } from "path";

describe("onboarding review empty people copy", () => {
  const source = readFileSync(join(__dirname, "onboarding-review-dialog.tsx"), "utf8");

  it("keeps mixed-source wording when people may come from RegTank or CTOS", () => {
    expect(source).toContain(
      "No directors or shareholders have been added yet. Refresh after the latest external information is available."
    );
  });
});
