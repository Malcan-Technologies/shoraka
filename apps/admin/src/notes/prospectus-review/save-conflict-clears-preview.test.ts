import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(__dirname, "../../app/notes/[id]/prospectus/page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");

describe("prospectus Save Draft conflict — preview invalidation", () => {
  it("clears live preview html and closes Preview sheet on 409 conflict", () => {
    // The conflict block is in onSave() catch(e).
    expect(pageSource).toContain("ProspectusReviewConflictError");
    expect(pageSource).toContain("setDirty(false)");

    // New behavior for bug #3.
    expect(pageSource).toContain("setLivePreviewHtml(null)");
    expect(pageSource).toContain("setPreviewOpen(false)");

    // Assert these calls are in the conflict handling block.
    expect(pageSource).toMatch(
      /ProspectusReviewConflictError[\s\S]{0,600}void refetch\(\);[\s\S]{0,200}setDirty\(false\);[\s\S]{0,200}setLivePreviewHtml\(null\);[\s\S]{0,200}setPreviewOpen\(false\);/
    );
  });
});

