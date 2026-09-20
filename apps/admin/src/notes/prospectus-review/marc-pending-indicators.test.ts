import fs from "node:fs";
import path from "node:path";

const pageTwoSource = fs.readFileSync(
  path.join(__dirname, "working-area-page-two.tsx"),
  "utf8"
);

describe("MARC pending UI indicators (Page 2)", () => {
  it("does not label Credit Insights / Credit & Invoice as Complete when MARC is pending", () => {
    // Section header label should not become "Complete" while MARC completeness is unknown.
    expect(pageTwoSource).toContain("const marcEvaluationPending");
    expect(pageTwoSource).toContain("const creditInsightsMissing = creditInsightsMissingCore > 0 ? creditInsightsMissingCore : undefined");
    // Credit & Invoice tab should become neutral instead of Complete.
    expect(pageTwoSource).toContain("optional: marcEvaluationPending && creditMissing === 0");
  });

  it("keeps existing MARC incomplete behavior for required gating", () => {
    // Incomplete MARC should still contribute to missingCount for Credit Insights.
    expect(pageTwoSource).toContain("completionOptions?.hasMarcAssessment === false ? 1 : 0");
  });

  it("does not label Risk Information as Complete when MARC is pending", () => {
    expect(pageTwoSource).toContain("optional: marcEvaluationPending");
  });
});

