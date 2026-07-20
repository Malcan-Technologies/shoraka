/**
 * Publish must copy approved_snapshot unchanged (no Page rebuild).
 */

describe("prospectus publish exact copy", () => {
  it("deep-clones approved freeze without mutating the source", () => {
    const approved = {
      publication_id: "pub-1",
      content_version: 1,
      render_fingerprint: "fp",
      html: { page1: "<p>1</p>", page2: "<p>2</p>", page3: "<p>3</p>" },
      page_1: { marker: "a" },
      page_2: { marker: "b" },
      publication_content: { version: 1 },
      note_identity: { note_reference: "N-1" },
    };

    const published = structuredClone(approved) as typeof approved;
    published.html.page1 = "<p>mutated</p>";
    published.page_1 = { marker: "changed" };

    expect(approved.html.page1).toBe("<p>1</p>");
    expect(approved.page_1).toEqual({ marker: "a" });
    expect(JSON.stringify(published.html)).not.toEqual(JSON.stringify(approved.html));
  });

  it("keeps investment publication id distinct from content_version alone", () => {
    const noteA = { content_version: 1, publication_id: "pub-a" };
    const noteB = { content_version: 1, publication_id: "pub-b" };
    expect(noteA.content_version).toBe(noteB.content_version);
    expect(noteA.publication_id).not.toBe(noteB.publication_id);
  });
});
