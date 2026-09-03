import { convertHtmlToPdf, HtmlToPdfError, resolveGotenbergUrl } from "./convert-html-to-pdf";

describe("convertHtmlToPdf", () => {
  const original = process.env.GOTENBERG_URL;

  afterEach(() => {
    process.env.GOTENBERG_URL = original;
    jest.restoreAllMocks();
  });

  it("posts to Chromium HTML convert, not LibreOffice", async () => {
    process.env.GOTENBERG_URL = "http://gotenberg.test:3000/";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("%PDF-1.4 mock"),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pdf = await convertHtmlToPdf("<html><body>Hi</body></html>");
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://gotenberg.test:3000/forms/chromium/convert/html");
    expect(init.method).toBe("POST");
    expect(url).not.toContain("libreoffice");
  });

  it("throws GOTENBERG_MISSING when URL is unset", async () => {
    delete process.env.GOTENBERG_URL;
    expect(resolveGotenbergUrl()).toBeNull();
    await expect(convertHtmlToPdf("<html></html>")).rejects.toMatchObject({
      code: "GOTENBERG_MISSING",
    });
    await expect(convertHtmlToPdf("<html></html>")).rejects.toBeInstanceOf(HtmlToPdfError);
  });
});
