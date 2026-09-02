const mockRenderHtmlToPdfBuffer = jest.fn();

jest.mock("../../../lib/playwright/render-html-to-pdf", () => ({
  renderHtmlToPdfBuffer: (...args: unknown[]) => mockRenderHtmlToPdfBuffer(...args),
}));

import { renderProspectusHtmlToPdfBuffer } from "./render-prospectus-html-to-pdf";

describe("renderProspectusHtmlToPdfBuffer", () => {
  it("delegates HTML to the shared Playwright helper with prospectus log label", async () => {
    mockRenderHtmlToPdfBuffer.mockResolvedValue(Buffer.from("%PDF-prospectus"));
    const pdf = await renderProspectusHtmlToPdfBuffer("<html>page</html>");
    expect(mockRenderHtmlToPdfBuffer).toHaveBeenCalledWith("<html>page</html>", {
      logLabel: "prospectus",
    });
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
