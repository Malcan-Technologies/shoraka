import {
  isNewContractFinancingStructure,
  isTerminalOriginatingApplicationStatus,
  pickEarliestOriginatingApplication,
} from "@cashsouk/types";
import {
  attachInheritedFacilityGuarantors,
  attachInheritedFacilitySupportingDocuments,
  loadInheritedGuarantorsForExistingContract,
  loadInheritedSupportingDocumentsForExistingContract,
} from "./contract-originating-application";

describe("contract originating application helpers", () => {
  it("detects new_contract financing structure", () => {
    expect(isNewContractFinancingStructure({ structure_type: "new_contract" })).toBe(true);
    expect(isNewContractFinancingStructure({ structure_type: "existing_contract" })).toBe(false);
  });

  it("treats only COMPLETED as a terminal origin status", () => {
    expect(isTerminalOriginatingApplicationStatus("COMPLETED")).toBe(true);
    expect(isTerminalOriginatingApplicationStatus("APPROVED")).toBe(false);
    expect(isTerminalOriginatingApplicationStatus("UNDER_REVIEW")).toBe(false);
  });

  it("picks earliest submitted new_contract origin candidate", () => {
    const picked = pickEarliestOriginatingApplication([
      {
        id: "later",
        submitted_at: new Date("2026-02-01"),
        updated_at: new Date("2026-02-02"),
      },
      {
        id: "earlier",
        submitted_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-02"),
      },
    ]);
    expect(picked?.id).toBe("earlier");
  });
});

describe("inherited facility guarantors", () => {
  const originatingGuarantors = [
    {
      id: "g1",
      application_id: "origin-app",
      client_guarantor_id: "g-individual-1",
      email: "g@example.com",
    },
  ];

  function mockDb(overrides?: { findUnique?: unknown }) {
    return {
      application: {
        findUnique: jest.fn().mockResolvedValue(
          overrides && "findUnique" in overrides
            ? overrides.findUnique
            : {
                id: "origin-app",
                display_reference: "APP-FAC-1",
                financing_type: { product_id: "prod_1" },
                application_guarantors: originatingGuarantors,
              }
        ),
      },
    };
  }

  it("loads guarantors from the originating facility application", async () => {
    const db = mockDb();
    const result = await loadInheritedGuarantorsForExistingContract(db as never, {
      contractId: "con-1",
      originatingApplicationId: "origin-app",
    });
    expect(result).toEqual({
      source_application_id: "origin-app",
      source_display_reference: "APP-FAC-1",
      source_product_id: "prod_1",
      application_guarantors: originatingGuarantors,
    });
    expect(db.application.findUnique).toHaveBeenCalledWith({
      where: { id: "origin-app" },
      select: {
        id: true,
        display_reference: true,
        financing_type: true,
        application_guarantors: { orderBy: { position: "asc" } },
      },
    });
  });

  it("overlays originating guarantors on approved existing_contract drawdowns", async () => {
    const db = mockDb();
    const result = await attachInheritedFacilityGuarantors(db as never, {
      financing_structure: { structure_type: "existing_contract" },
      contract_id: "con-1",
      contract: { status: "APPROVED", originating_application_id: "origin-app" },
      application_guarantors: [],
    });
    expect(result.inherited_guarantors?.source_application_id).toBe("origin-app");
    expect(result.application_guarantors).toEqual(originatingGuarantors);
  });

  it("does not overlay guarantors for a new facility application", async () => {
    const db = mockDb();
    const local = [{ id: "local-g" }];
    const result = await attachInheritedFacilityGuarantors(db as never, {
      financing_structure: { structure_type: "new_contract" },
      contract_id: "con-1",
      contract: { status: "APPROVED", originating_application_id: "origin-app" },
      application_guarantors: local,
    });
    expect(result.inherited_guarantors).toBeNull();
    expect(result.application_guarantors).toEqual(local);
    expect(db.application.findUnique).not.toHaveBeenCalled();
  });
});

describe("inherited facility supporting documents", () => {
  const originDocs = {
    categories: [
      {
        name: "Legal Docs",
        documents: [
          {
            title: "Deed of Assignment",
            workflow_document_index: 0,
            file: { s3_key: "facility/doa.pdf", file_name: "doa.pdf" },
          },
        ],
      },
    ],
  };
  const originReviewItems = [
    {
      item_type: "document",
      item_id: "supporting_documents:legal_docs:0:Deed_of_Assignment",
      status: "APPROVED",
    },
  ];
  const workflow = [
    {
      id: "supporting_documents_1",
      config: {
        facility_locked_categories: ["legal_docs"],
        legal_docs: [{ name: "Deed of Assignment" }],
        financial_docs: [{ name: "Latest Management Account" }],
      },
    },
  ];

  function mockDocsDb() {
    return {
      application: {
        findUnique: jest.fn().mockResolvedValue({
          id: "origin-app",
          supporting_documents: originDocs,
          application_review_items: originReviewItems,
        }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({ workflow }),
      },
    };
  }

  it("overlays locked facility documents onto an existing_contract drawdown", async () => {
    const db = mockDocsDb();
    const result = await attachInheritedFacilitySupportingDocuments(db as never, {
      financing_type: { product_id: "prod_1" },
      product_version: 2,
      financing_structure: { structure_type: "existing_contract" },
      contract_id: "con-1",
      contract: { status: "APPROVED", originating_application_id: "origin-app" },
      supporting_documents: {
        categories: [
          {
            name: "Financial Docs",
            documents: [{ title: "Latest Management Account", file: { s3_key: "drawdown/mgmt.pdf" } }],
          },
        ],
      },
      application_review_items: [],
    });

    expect(result.facility_locked_supporting_categories).toEqual(["legal_docs"]);
    expect(result.inherited_supporting_documents?.source_application_id).toBe("origin-app");
    const categories = (result.supporting_documents as { categories: Array<{ name: string }> }).categories;
    expect(categories.some((cat) => cat.name === "Legal Docs")).toBe(true);
    expect(result.application_review_items).toEqual(originReviewItems);
  });

  it("does not overlay supporting documents on a new facility application", async () => {
    const db = mockDocsDb();
    const localDocs = { categories: [] };
    const result = await attachInheritedFacilitySupportingDocuments(db as never, {
      financing_type: { product_id: "prod_1" },
      product_version: 2,
      financing_structure: { structure_type: "new_contract" },
      contract_id: "con-1",
      contract: { status: "APPROVED", originating_application_id: "origin-app" },
      supporting_documents: localDocs,
      application_review_items: [],
    });
    expect(result.facility_locked_supporting_categories).toEqual([]);
    expect(result.inherited_supporting_documents).toBeNull();
    expect(result.supporting_documents).toBe(localDocs);
    expect(db.application.findUnique).not.toHaveBeenCalled();
  });

  it("loads origin supporting documents when an originating application id is known", async () => {
    const db = mockDocsDb();
    const result = await loadInheritedSupportingDocumentsForExistingContract(db as never, {
      contractId: "con-1",
      originatingApplicationId: "origin-app",
    });
    expect(result?.source_application_id).toBe("origin-app");
    expect(result?.review_items).toEqual(originReviewItems);
  });
});
