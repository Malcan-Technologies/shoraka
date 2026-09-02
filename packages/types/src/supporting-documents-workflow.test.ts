import {
  collectSupportingDocumentS3Keys,
  FACILITY_LOCKED_CATEGORIES_KEY,
  SUPPORTING_DOC_CATEGORY_SETTINGS_KEY,
  facilityLockedSupportingDocumentsChanged,
  getFacilityLockedCategoriesFromWorkflow,
  isFacilityLockedSupportingDocumentItem,
  mergeFacilityLockedSupportingDocuments,
  mergeFacilityLockedSupportingDocumentReviewItems,
  parseFacilityLockedCategories,
  parseSupportingDocumentItemCategoryKey,
  serializeFacilityLockedCategorySettings,
  stripFacilityLockedSupportingDocuments,
  supportingDocCategoryKeyFromLabel,
  supportingDocumentCategoryEntries,
} from "./supporting-documents-workflow";

const originDocs = {
  categories: [
    {
      name: "Legal Docs",
      documents: [
        {
          title: "Deed of Assignment",
          workflow_document_index: 0,
          file: { file_name: "doa.pdf", s3_key: "facility/doa.pdf" },
        },
      ],
    },
    {
      name: "Financial Docs",
      documents: [
        {
          title: "Latest Management Account",
          workflow_document_index: 0,
          file: { file_name: "mgmt.pdf", s3_key: "facility/mgmt.pdf" },
        },
      ],
    },
  ],
};

const drawdownDocs = {
  categories: [
    {
      name: "Financial Docs",
      documents: [
        {
          title: "Latest Management Account",
          workflow_document_index: 0,
          file: { file_name: "drawdown-mgmt.pdf", s3_key: "drawdown/mgmt.pdf" },
        },
      ],
    },
  ],
};

describe("facility-locked supporting document config", () => {
  it("parses lock flags from category_settings and the legacy array", () => {
    expect(
      parseFacilityLockedCategories({
        [SUPPORTING_DOC_CATEGORY_SETTINGS_KEY]: {
          legal_docs: { lock_at_facility: true },
          others: { lock_at_facility: false },
        },
      })
    ).toEqual(["legal_docs"]);
    expect(
      parseFacilityLockedCategories({
        [FACILITY_LOCKED_CATEGORIES_KEY]: ["legal_docs", "legal_docs", "unknown", "financial_docs"],
        legal_docs: [{ name: "Deed of Assignment" }],
      })
    ).toEqual(["legal_docs", "financial_docs"]);
  });

  it("does not treat the lock list as a document category", () => {
    expect(
      supportingDocumentCategoryEntries({
        [FACILITY_LOCKED_CATEGORIES_KEY]: ["legal_docs"],
        legal_docs: [{ name: "Deed of Assignment" }],
      })
    ).toEqual([["legal_docs", [{ name: "Deed of Assignment" }]]]);
  });

  it("does not treat acceptance_documents as a supporting-document category", () => {
    expect(
      supportingDocumentCategoryEntries({
        acceptance_documents: [{ name: "Board Resolution" }],
        legal_docs: [{ name: "Deed of Assignment" }],
      })
    ).toEqual([["legal_docs", [{ name: "Deed of Assignment" }]]]);
  });

  it("serializes lock flags as an object, not a document list", () => {
    expect(serializeFacilityLockedCategorySettings(["legal_docs", "unknown"])).toEqual({
      legal_docs: { lock_at_facility: true },
    });
    expect(serializeFacilityLockedCategorySettings([])).toBeUndefined();
  });

  it("reads lock keys from the supporting_documents workflow step", () => {
    expect(
      getFacilityLockedCategoriesFromWorkflow([
        {
          id: "supporting_documents_1",
          config: { [FACILITY_LOCKED_CATEGORIES_KEY]: ["legal_docs"] },
        },
      ])
    ).toEqual(["legal_docs"]);
    expect(
      getFacilityLockedCategoriesFromWorkflow([
        {
          id: "supporting_documents_1",
          config: {
            [SUPPORTING_DOC_CATEGORY_SETTINGS_KEY]: { legal_docs: { lock_at_facility: true } },
          },
        },
      ])
    ).toEqual(["legal_docs"]);
  });

  it("maps category labels and item ids", () => {
    expect(supportingDocCategoryKeyFromLabel("Legal Docs")).toBe("legal_docs");
    expect(parseSupportingDocumentItemCategoryKey("supporting_documents:legal_docs:0:Deed_of_Assignment")).toBe(
      "legal_docs"
    );
    expect(
      parseSupportingDocumentItemCategoryKey("supporting_documents:doc:financial_docs:1:Latest_Management_Account")
    ).toBe("financial_docs");
    expect(
      isFacilityLockedSupportingDocumentItem("supporting_documents:legal_docs:0:Deed_of_Assignment", ["legal_docs"])
    ).toBe(true);
  });
});

describe("facility-locked supporting document payloads", () => {
  it("overlays locked origin categories onto the drawdown payload", () => {
    const merged = mergeFacilityLockedSupportingDocuments({
      drawdownDocs,
      originDocs,
      lockedKeys: ["legal_docs"],
    }) as { categories: Array<{ name: string; documents: Array<{ file?: { s3_key?: string } }> }> };

    const legal = merged.categories.find((cat) => cat.name === "Legal Docs");
    const financial = merged.categories.find((cat) => cat.name === "Financial Docs");
    expect(legal?.documents[0]?.file?.s3_key).toBe("facility/doa.pdf");
    expect(financial?.documents[0]?.file?.s3_key).toBe("drawdown/mgmt.pdf");
  });

  it("strips locked categories before persist", () => {
    const merged = mergeFacilityLockedSupportingDocuments({
      drawdownDocs,
      originDocs,
      lockedKeys: ["legal_docs"],
    });
    const stripped = stripFacilityLockedSupportingDocuments(merged, ["legal_docs"]) as {
      categories: Array<{ name: string }>;
    };
    expect(stripped.categories.map((cat) => cat.name)).toEqual(["Financial Docs"]);
  });

  it("treats omitted locked categories as unchanged and rejects swapped files", () => {
    expect(facilityLockedSupportingDocumentsChanged(drawdownDocs, originDocs, ["legal_docs"])).toBe(
      false
    );
    expect(
      facilityLockedSupportingDocumentsChanged(
        {
          categories: [
            {
              name: "Legal Docs",
              documents: [{ file: { s3_key: "tampered/doa.pdf" } }],
            },
          ],
        },
        originDocs,
        ["legal_docs"]
      )
    ).toBe(true);
  });

  it("collects locked origin s3 keys", () => {
    expect(collectSupportingDocumentS3Keys(originDocs, ["legal_docs"])).toEqual(["facility/doa.pdf"]);
  });

  it("overlays origin review items for locked categories", () => {
    const merged = mergeFacilityLockedSupportingDocumentReviewItems(
      [
        { item_type: "document", item_id: "supporting_documents:financial_docs:0:Latest_Management_Account", status: "PENDING" },
      ],
      [
        { item_type: "document", item_id: "supporting_documents:legal_docs:0:Deed_of_Assignment", status: "APPROVED" },
        { item_type: "document", item_id: "supporting_documents:financial_docs:0:Latest_Management_Account", status: "APPROVED" },
      ],
      ["legal_docs"]
    );
    expect(merged).toEqual([
      {
        item_type: "document",
        item_id: "supporting_documents:financial_docs:0:Latest_Management_Account",
        status: "PENDING",
      },
      {
        item_type: "document",
        item_id: "supporting_documents:legal_docs:0:Deed_of_Assignment",
        status: "APPROVED",
      },
    ]);
  });
});
