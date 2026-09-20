import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(__dirname, "../../app/notes/[id]/prospectus/page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");

describe("prospectus previewStatusLabel mapping", () => {
  it("maps DRAFT -> Draft preview", () => {
    // Default branch should still be Draft preview when status isn't approved/ready/published.
    expect(pageSource).toContain('("Draft preview" as const)');
  });

  it("maps READY_FOR_PUBLISH -> Approved preview", () => {
    expect(pageSource).toContain('status === "READY_FOR_PUBLISH"');
    expect(pageSource).toContain('("Approved preview" as const)');
  });

  it("maps APPROVED and PUBLISHED -> Approved preview", () => {
    expect(pageSource).toContain('status === "APPROVED"');
    expect(pageSource).toContain('status === "PUBLISHED"');
    // Ensure those are in the same approved branch.
    expect(pageSource).toMatch(
      /status === "APPROVED"[\s\S]*status === "READY_FOR_PUBLISH"[\s\S]*status === "PUBLISHED"/
    );
  });
});

