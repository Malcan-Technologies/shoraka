import * as fs from "fs";
import * as path from "path";
import { formatNoteDateEnMy } from "@cashsouk/types";

describe("source invoices table date display", () => {
  const source = fs.readFileSync(path.join(__dirname, "source-invoices-table.tsx"), "utf8");

  it("routes invoice due dates through the shared UTC-stable formatter", () => {
    expect(source).toContain("formatNoteDateEnMy");
    expect(source).not.toContain('toLocaleDateString("en-MY")');
    expect(formatNoteDateEnMy("2026-11-18T00:00:00.000Z")).toBe("18 Nov 2026");
    expect(formatNoteDateEnMy("2026-11-18")).toBe("18 Nov 2026");
  });
});
