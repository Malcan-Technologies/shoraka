import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Paymaster assignment card copy", () => {
  const source = readFileSync(join(__dirname, "paymaster-assignment-card.tsx"), "utf8");

  it("does not show placeholder legal-template or disbursement-readiness copy", () => {
    expect(source).not.toMatch(/legal wording is pending/i);
    expect(source).not.toMatch(/assignment particulars/i);
    expect(source).not.toMatch(/not a substitute/i);
    expect(source).not.toMatch(/templatePending/);
    expect(source).not.toMatch(/ASSIGNMENT_NOTICE_LEGAL_TEMPLATE_PENDING/);
    expect(source).not.toMatch(/Disbursement readiness/);
  });

  it("matches the disbursement step layout used by Tawarruq and trustee", () => {
    expect(source).toContain("Paymaster assignment");
    expect(source).toContain("Paymaster assignment complete");
    expect(source).toContain("CollapsibleDetailTimeline");
    expect(source).toContain("workflowTaskSurfaceClass");
    expect(source).toContain("justify-end gap-2 border-t");
    expect(source).toContain("Download the notice, send it to the Paymaster, then mark it sent.");
  });
});
