import { reviewSectionHasResubmitChanges } from "./review-section-has-resubmit-changes";

const paths = (...p: string[]) => p.map((path) => ({ path }));

describe("reviewSectionHasResubmitChanges — financial", () => {
  it("documents-only resubmit does not mark Financial changed", () => {
    const changes = paths("supporting_documents.categories[0].documents[0].file_name");
    expect(reviewSectionHasResubmitChanges("financial", changes)).toBe(false);
    expect(reviewSectionHasResubmitChanges("supporting_documents", changes)).toBe(true);
  });

  it.each([
    "financial_statements.admin_input_by_year.2025.bsfatot",
    "financial_statements.admin_field_overrides.2026.bsfatot.edit_user_input.value",
    "financial_statements.questionnaire.financial_year_end",
    "financing_type.product_id",
    "financing_structure.structure_type",
    "issuer_organization.latest_organization_ctos_financials_json",
  ])("%s alone does not mark Financial changed", (path) => {
    expect(reviewSectionHasResubmitChanges("financial", paths(path))).toBe(false);
  });

  it("an issuer unaudited_by_year value change marks Financial changed", () => {
    expect(
      reviewSectionHasResubmitChanges("financial", paths("financial_statements.unaudited_by_year.2027.bsfatot"))
    ).toBe(true);
  });
});
