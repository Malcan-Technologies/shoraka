import { productUploadTemplateUrlBodySchema } from "./schemas";

const baseBody = {
  categoryKey: "acceptance_documents",
  templateIndex: 0,
  fileName: "board.docx",
};

describe("productUploadTemplateUrlBodySchema", () => {
  it("accepts Word MIME types", () => {
    expect(
      productUploadTemplateUrlBodySchema.parse({
        ...baseBody,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).contentType
    ).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(
      productUploadTemplateUrlBodySchema.parse({
        ...baseBody,
        fileName: "board.doc",
        contentType: "application/msword",
      }).contentType
    ).toBe("application/msword");
  });

  it("still accepts PDF and Excel", () => {
    expect(
      productUploadTemplateUrlBodySchema.parse({
        ...baseBody,
        fileName: "board.pdf",
        contentType: "application/pdf",
      }).contentType
    ).toBe("application/pdf");
    expect(
      productUploadTemplateUrlBodySchema.parse({
        ...baseBody,
        fileName: "schedule.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }).contentType
    ).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("rejects non-document types", () => {
    expect(() =>
      productUploadTemplateUrlBodySchema.parse({
        ...baseBody,
        fileName: "image.png",
        contentType: "image/png",
      })
    ).toThrow(/PDF, Word, or Excel/);
  });
});
