import {
  convertDocxToPdf,
  DocxToPdfError,
  resolveGotenbergUrl,
} from "./convert-docx-to-pdf";

describe("convertDocxToPdf", () => {
  const original = process.env.GOTENBERG_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.GOTENBERG_URL;
    } else {
      process.env.GOTENBERG_URL = original;
    }
    jest.restoreAllMocks();
  });

  it("posts to LibreOffice convert, not Chromium HTML", async () => {
    process.env.GOTENBERG_URL = "http://gotenberg.test:3000/";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("%PDF-1.4 mock"),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pdf = await convertDocxToPdf(Buffer.from("docx"), {
      fileName: "investment-note-certificate.docx",
    });
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://gotenberg.test:3000/forms/libreoffice/convert");
    expect(init.method).toBe("POST");
    expect(url).not.toContain("chromium");
  });

  it("defaults the upload name so Letter of Offer callers stay unchanged", async () => {
    process.env.GOTENBERG_URL = "http://gotenberg.test:3000";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("%PDF-1.4 mock"),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await convertDocxToPdf(Buffer.from("docx"));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    const file = body.get("files") as File;
    expect(file.name).toBe("letter-of-offer.docx");
  });

  it("throws GOTENBERG_MISSING when URL is unset", async () => {
    delete process.env.GOTENBERG_URL;
    expect(resolveGotenbergUrl()).toBeNull();
    await expect(convertDocxToPdf(Buffer.from("docx"))).rejects.toMatchObject({
      name: "DocxToPdfError",
      code: "GOTENBERG_MISSING",
    } satisfies Partial<DocxToPdfError>);
  });
});
