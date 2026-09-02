import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin Paymaster registry list", () => {
  it("returns the same linked counts as Paymaster Detail summary cards", () => {
    const src = readFileSync(join(__dirname, "service.ts"), "utf8");
    expect(src).toMatch(/linkedFacilityCount: row\._count\.contracts/);
    expect(src).toMatch(/linkedNoteCount: row\._count\.notes/);
    expect(src).toMatch(/noticeCount: row\._count\.assignment_notices/);
    expect(src).toMatch(/latestIssuerName: row\.issuer_links\[0\]\?\.issuer_organization\.name/);
    expect(src).toMatch(/contracts: true/);
    expect(src).toMatch(/assignment_notices: true/);
  });
});
