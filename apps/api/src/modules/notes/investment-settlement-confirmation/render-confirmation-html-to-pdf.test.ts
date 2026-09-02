const mockRenderHtmlToPdfBuffer = jest.fn();

jest.mock("../../../lib/playwright/render-html-to-pdf", () => ({
  renderHtmlToPdfBuffer: (...args: unknown[]) => mockRenderHtmlToPdfBuffer(...args),
}));

import { renderConfirmationHtmlToPdfBuffer } from "./render-confirmation-html-to-pdf";

describe("renderConfirmationHtmlToPdfBuffer", () => {
  it("delegates HTML to the shared Playwright helper", async () => {
    mockRenderHtmlToPdfBuffer.mockResolvedValue(Buffer.from("%PDF-confirmation"));
    const pdf = await renderConfirmationHtmlToPdfBuffer("<html>settled</html>");
    expect(mockRenderHtmlToPdfBuffer).toHaveBeenCalledWith("<html>settled</html>", {
      logLabel: "investment-settlement-confirmation",
    });
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
