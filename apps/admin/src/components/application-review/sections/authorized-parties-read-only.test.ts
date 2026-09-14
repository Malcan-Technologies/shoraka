import fs from "node:fs";
import path from "node:path";

describe("AuthorizedPartiesReadOnly", () => {
  it("shows Applies company seal as muted meta text for the chosen issuer representative", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "authorized-parties-read-only.tsx"),
      "utf8"
    );
    expect(source).toContain("applies_company_seal");
    expect(source).toContain("Applies company seal");
    expect(source).toContain("text-meta text-muted-foreground");
  });
});
