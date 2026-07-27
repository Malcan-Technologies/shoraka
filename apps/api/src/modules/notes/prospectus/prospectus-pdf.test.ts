import {
  buildProspectusPdfObjectKey,
  countPdfPagesFromBuffer,
  countProspectusHtmlPages,
  prospectusPdfFileName,
  sha256Hex,
} from "./prospectus-pdf";

describe("prospectus PDF helpers", () => {
  it("builds an immutable publication-specific S3 key", () => {
    const key = buildProspectusPdfObjectKey({
      noteId: "note_1",
      publicationId: "pub_1",
      snapshotHash: "abc123def456",
    });
    expect(key).toMatch(/^prospectuses\/[^/]+\/note_1\/pub_1\/abc123def456\.pdf$/);
  });

  it("counts exactly three .page nodes in combined HTML", () => {
    const html = `
      <html><body>
        <section class="page prospectus-page-one">1</section>
        <section class="page prospectus-page-two">2</section>
        <section class="page prospectus-page-three">3</section>
      </body></html>
    `;
    expect(countProspectusHtmlPages(html)).toBe(3);
  });

  it("rejects accidental fourth page in HTML count", () => {
    const html = `
      <section class="page">1</section>
      <section class="page">2</section>
      <section class="page">3</section>
      <section class="page">4</section>
    `;
    expect(countProspectusHtmlPages(html)).toBe(4);
  });

  it("counts PDF page markers and hashes content", () => {
    const pdf = Buffer.from("%PDF-1.4 /Type /Page /Type /Page /Type /Page /Type /Pages");
    expect(countPdfPagesFromBuffer(pdf)).toBe(3);
    expect(sha256Hex(Buffer.from("hello"))).toHaveLength(64);
  });

  it("builds a safe PDF filename from note reference", () => {
    expect(prospectusPdfFileName("NOTE-123")).toBe("CashSouk-Prospectus-NOTE-123.pdf");
    expect(prospectusPdfFileName("Acme / Issuer")).toBe(
      "CashSouk-Prospectus-Acme-Issuer.pdf"
    );
  });
});
