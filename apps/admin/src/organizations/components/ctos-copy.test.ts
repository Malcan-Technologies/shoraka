import { readFileSync } from "fs";
import { join } from "path";

const source = [
  join(__dirname, "organization-profile-overview-card.tsx"),
  join(__dirname, "organization-people-access-detail.tsx"),
  join(__dirname, "organization-people-access-panel.tsx"),
  join(__dirname, "organization-external-review-sheet.tsx"),
  join(__dirname, "../utils/organization-profile-overview.ts"),
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

describe("Admin People CTOS copy", () => {
  it("uses CTOS wording for CTOS party observations", () => {
    expect(source).toContain("The latest CTOS information matches this profile.");
    expect(source).toContain("CTOS information differs from the current profile.");
    expect(source).toContain("from CTOS");
    expect(source).toContain("not found in the latest CTOS information");
    expect(source).toContain("Review CTOS changes");
    expect(source).toContain("Leave as CTOS observation");
    expect(source).toContain("Leave as current profile");
    expect(source).toContain("Keep current value");
    expect(source).toContain("Use CTOS value");
  });

  it("does not keep generic external-information copy on CTOS-only screens", () => {
    expect(source).not.toContain("external information");
    expect(source).not.toContain("External information");
    expect(source).not.toContain("latest external information");
  });
});
