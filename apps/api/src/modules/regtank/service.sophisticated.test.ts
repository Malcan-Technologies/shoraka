import { readFileSync } from "fs";
import { join } from "path";
import { appliesRegTankSophisticatedStatus } from "@cashsouk/types";

describe("RegTank sophisticated investor status", () => {
  const source = readFileSync(join(__dirname, "service.ts"), "utf8");

  it("does not automatically treat companies as sophisticated", () => {
    expect(appliesRegTankSophisticatedStatus("COMPANY")).toBe(false);
    expect(source).not.toContain('reason: "Company organization"');
    expect(source).toContain("appliesRegTankSophisticatedStatus(org.type)");
    expect(source).not.toContain("organizationType === \"COMPANY\"");
  });
});
