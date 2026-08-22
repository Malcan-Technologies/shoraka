import {
  collectAcceptanceDocumentReviewKeys,
  resolveNotePublishAcceptanceReview,
} from "./acceptance-documents";

function financingWorkflow(config: Record<string, unknown>) {
  return [{ id: "financing_type_1", config }];
}

const workflow = financingWorkflow({
  acceptance_documents: [
    { name: "Letter of Offer", required: true },
    { name: "Board Resolution", required: true },
  ],
});

const uploadedDocs = {
  documents: [
    {
      title: "Letter of Offer",
      workflow_document_index: 0,
      file: { file_name: "offer.pdf", file_size: 12, s3_key: "s3/offer.pdf" },
    },
    {
      title: "Board Resolution",
      workflow_document_index: 1,
      file: { file_name: "board.pdf", file_size: 10, s3_key: "s3/board.pdf" },
    },
  ],
};

describe("resolveNotePublishAcceptanceReview", () => {
  it("uses source-application uploads when present", () => {
    expect(
      resolveNotePublishAcceptanceReview({
        workflow,
        sourceApplicationId: "invoice-app",
        sourceAcceptanceDocuments: uploadedDocs,
        originatingApplicationId: "facility-app",
        originatingAcceptanceDocuments: null,
      })
    ).toEqual({
      applicationId: "invoice-app",
      docKeys: collectAcceptanceDocumentReviewKeys(workflow, uploadedDocs),
    });
  });

  it("falls back to the facility application for invoice draws with no uploads", () => {
    expect(
      resolveNotePublishAcceptanceReview({
        workflow,
        sourceApplicationId: "invoice-app",
        sourceAcceptanceDocuments: null,
        originatingApplicationId: "facility-app",
        originatingAcceptanceDocuments: uploadedDocs,
      })
    ).toEqual({
      applicationId: "facility-app",
      docKeys: collectAcceptanceDocumentReviewKeys(workflow, uploadedDocs),
    });
  });

  it("keeps the source application when neither app has uploads", () => {
    expect(
      resolveNotePublishAcceptanceReview({
        workflow,
        sourceApplicationId: "invoice-only-app",
        sourceAcceptanceDocuments: null,
        originatingApplicationId: null,
      })
    ).toEqual({ applicationId: "invoice-only-app", docKeys: [] });
  });
});
