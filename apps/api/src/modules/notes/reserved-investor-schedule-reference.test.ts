import { readFileSync } from "node:fs";
import { join } from "node:path";

const notesServiceSource = readFileSync(join(__dirname, "./service.ts"), "utf8");

describe("reserved investor schedule reference", () => {
  it("reserves the canonical investor schedule reference when closeFunding marks funding successful", () => {
    const closeFundingIdx = notesServiceSource.indexOf("async closeFunding");
    expect(closeFundingIdx).toBeGreaterThan(-1);

    const block = notesServiceSource.slice(closeFundingIdx, closeFundingIdx + 5000);
    expect(block).toContain("reserved_investor_schedule_reference");
    expect(block).toContain("reserved_investor_schedule_reference_version");
    expect(block).toContain("investorScheduleReferenceFor(");
  });
});

