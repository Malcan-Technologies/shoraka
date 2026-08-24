import { extractDocumentDisplayNames } from "./extract-document-names";

describe("extractDocumentDisplayNames", () => {
  it("collects names from supporting, acceptance, invoice, and business uploads", () => {
    const names = extractDocumentDisplayNames({
      supporting_documents: {
        financial_docs: [{ name: "Management accounts", file: { file_name: "ma.xlsx" } }],
        categories: [
          {
            name: "Legal Docs",
            documents: [
              {
                title: "Board pack",
                files: [{ file_name: "pack.pdf", s3_key: "applications/x/pack.pdf" }],
              },
            ],
          },
        ],
      },
      acceptance_documents: {
        documents: [{ title: "Board resolution", file: { file_name: "br.pdf" } }],
      },
      invoices: [
        {
          details: { document: { file_name: "inv-1.pdf", s3_key: "applications/x/inv.pdf" } },
        },
      ],
      business_details: {
        why_raising_funds: {
          supporting_documents: [{ file_name: "use-of-funds.pdf", s3_key: "applications/x/uof.pdf" }],
        },
      },
    });

    expect(names).toEqual(
      expect.arrayContaining([
        "Management accounts",
        "Board pack",
        "Board resolution",
        "inv-1.pdf",
        "use-of-funds.pdf",
      ])
    );
    expect(names.join(" ")).not.toContain("applications/x/");
    expect(names.join(" ")).not.toContain("s3_key");
  });

  it("ignores storage keys and empty payloads", () => {
    expect(
      extractDocumentDisplayNames({
        supporting_documents: {
          others: [{ file: { s3_key: "applications/x/secret.pdf" } }],
        },
        invoices: [{ details: { document: { s3_key: "applications/x/inv.pdf" } } }],
      })
    ).toEqual([]);
  });
});
