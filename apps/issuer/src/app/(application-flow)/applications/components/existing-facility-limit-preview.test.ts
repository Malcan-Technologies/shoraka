import { LEFT_ON_CONTRACT_LABEL, LEFT_TO_DRAW_LABEL } from "@cashsouk/types";
import * as fs from "fs";
import * as path from "path";

describe("existing facility dual-limit preview", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "existing-facility-limit-preview.tsx"),
    "utf8"
  );

  it("shows both remaining values and distinguishes draft warning from hard errors", () => {
    expect(source).toContain("LEFT_TO_DRAW_LABEL");
    expect(source).toContain("LEFT_ON_CONTRACT_LABEL");
    expect(source).toContain('role="alert"');
    expect(source).toContain('role="status"');
    expect(source).toContain("{warning && !hardError ?");
    expect(LEFT_TO_DRAW_LABEL).toMatch(/left to draw/i);
    expect(LEFT_ON_CONTRACT_LABEL).toMatch(/left on contract/i);
  });
});
