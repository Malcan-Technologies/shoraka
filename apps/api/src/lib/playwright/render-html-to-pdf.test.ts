import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_HTML_TO_PDF_OPTIONS,
  PLAYWRIGHT_SET_CONTENT_OPTIONS,
  renderHtmlToPdfBuffer,
} from "./render-html-to-pdf";

const mockPdf = jest.fn();
const mockSetContent = jest.fn();
const mockPageClose = jest.fn();
const mockBrowserClose = jest.fn();
const mockLaunch = jest.fn();

jest.mock("playwright", () => ({
  chromium: {
    launch: (...args: unknown[]) => mockLaunch(...args),
  },
}));

describe("renderHtmlToPdfBuffer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetContent.mockResolvedValue(undefined);
    mockPdf.mockResolvedValue(Buffer.from("%PDF-playwright"));
    mockPageClose.mockResolvedValue(undefined);
    mockBrowserClose.mockResolvedValue(undefined);
    mockLaunch.mockResolvedValue({
      newPage: async () => ({
        setContent: mockSetContent,
        pdf: mockPdf,
        close: mockPageClose,
      }),
      close: mockBrowserClose,
    });
  });

  it("launches Chromium and prints A4 with Prospectus PDF options", async () => {
    const pdf = await renderHtmlToPdfBuffer("<html><body>Hi</body></html>", {
      logLabel: "prospectus",
    });
    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: [...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS],
      })
    );
    expect(mockSetContent).toHaveBeenCalledWith(
      "<html><body>Hi</body></html>",
      PLAYWRIGHT_SET_CONTENT_OPTIONS
    );
    expect(mockPdf).toHaveBeenCalledWith(PLAYWRIGHT_HTML_TO_PDF_OPTIONS);
    expect(PLAYWRIGHT_HTML_TO_PDF_OPTIONS).toEqual({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(mockPageClose).toHaveBeenCalledTimes(1);
    expect(mockBrowserClose).toHaveBeenCalledTimes(1);
  });

  it("closes the browser when page.pdf fails", async () => {
    mockPdf.mockRejectedValue(new Error("chromium crashed"));
    await expect(renderHtmlToPdfBuffer("<html></html>")).rejects.toThrow("chromium crashed");
    expect(mockBrowserClose).toHaveBeenCalledTimes(1);
  });
});

describe("Prospectus reuse", () => {
  it("keeps renderProspectusHtmlToPdfBuffer as a wrapper around the shared helper", () => {
    const prospectus = readFileSync(
      join(__dirname, "../../modules/notes/prospectus/render-prospectus-html-to-pdf.ts"),
      "utf8"
    );
    expect(prospectus).toContain("export async function renderProspectusHtmlToPdfBuffer");
    expect(prospectus).toContain("renderHtmlToPdfBuffer");
    expect(prospectus).toContain('logLabel: "prospectus"');
    expect(prospectus).not.toContain("chromium.launch");
  });
});
