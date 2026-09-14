import {
  extractSignedPdfBufferFromFileResponse,
  MIN_SIGNED_PDF_BYTES,
  resolveSignedPdfFromContractFileResponse,
  tryDecodeHexStringToPdf,
} from "./signed-file";

function makeMinimalPdfBuffer(): Buffer {
  const pdf = Buffer.alloc(MIN_SIGNED_PDF_BYTES);
  pdf.write("%PDF-1.4\n", 0, "ascii");
  return pdf;
}

describe("tryDecodeHexStringToPdf", () => {
  it("decodes SignServer pdfdata (hex) to PDF bytes", () => {
    const pdf = makeMinimalPdfBuffer();
    const hex = pdf.toString("hex");
    const out = tryDecodeHexStringToPdf(hex);
    expect(out).not.toBeNull();
    expect(out!.equals(pdf)).toBe(true);
  });
});

describe("extractSignedPdfBufferFromFileResponse", () => {
  it("decodes documented pdfdata hex field", () => {
    const pdf = makeMinimalPdfBuffer();
    const hex = pdf.toString("hex");
    const out = extractSignedPdfBufferFromFileResponse({ pdfdata: hex });
    expect(out).not.toBeNull();
    expect(out!.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("decodes base64 PDF from file field", () => {
    const pdf = makeMinimalPdfBuffer();
    const b64 = pdf.toString("base64");
    const out = extractSignedPdfBufferFromFileResponse({ file: b64 });
    expect(out).not.toBeNull();
    expect(out!.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("finds PDF under arbitrary nested keys", () => {
    const pdf = makeMinimalPdfBuffer();
    const b64 = pdf.toString("base64");
    const out = extractSignedPdfBufferFromFileResponse({
      Response: { Data: { SignedFileContent: b64 } },
    });
    expect(out).not.toBeNull();
    expect(out!.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("decodes base64url variant", () => {
    const pdf = makeMinimalPdfBuffer();
    let b64 = pdf.toString("base64");
    b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const out = extractSignedPdfBufferFromFileResponse({ payload: b64 });
    expect(out).not.toBeNull();
  });
});

describe("resolveSignedPdfFromContractFileResponse", () => {
  it("fetches PDF from nested https URL when no embedded base64", async () => {
    const pdf = makeMinimalPdfBuffer();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await resolveSignedPdfFromContractFileResponse({
      Result: { DownloadLink: "https://signing.example/signed.pdf" },
    });
    expect(fetchMock).toHaveBeenCalledWith("https://signing.example/signed.pdf");
    expect(out).not.toBeNull();
    expect(out!.slice(0, 5).toString()).toBe("%PDF-");
  });
});
