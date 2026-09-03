import { AppError } from "../../lib/http/error-handler";
import { assertRequiredSupportingDocumentsPresent } from "./supporting-docs-workflow";

const workflow = [
  {
    id: "supporting_documents_1",
    config: {
      facility_locked_categories: ["legal_docs"],
      legal_docs: [{ name: "Deed of Assignment", required: true }],
      financial_docs: [{ name: "Latest Management Account", required: true }],
    },
  },
];

describe("assertRequiredSupportingDocumentsPresent", () => {
  it("requires unlocked categories even when a locked category is missing", () => {
    expect(() =>
      assertRequiredSupportingDocumentsPresent(workflow, {
        categories: [
          {
            name: "Legal Docs",
            documents: [{ file: { s3_key: "doa.pdf" } }],
          },
        ],
      })
    ).toThrow(AppError);
  });

  it("skips facility-locked categories on drawdowns", () => {
    expect(() =>
      assertRequiredSupportingDocumentsPresent(
        workflow,
        {
          categories: [
            {
              name: "Financial Docs",
              documents: [{ file: { s3_key: "mgmt.pdf" } }],
            },
          ],
        },
        { skipCategoryKeys: ["legal_docs"] }
      )
    ).not.toThrow();
  });
});
