import {
  convertDocxToPdf,
  DocxToPdfError,
  resolveGotenbergUrl,
} from "./convert-docx-to-pdf";
import { createContractLooFixture } from "./contract-loo-fixture";
import { renderContractLooDocx } from "./render-contract-loo-docx";

describe("convertDocxToPdf", () => {
  const originalGotenberg = process.env.GOTENBERG_URL;

  afterEach(() => {
    if (originalGotenberg === undefined) {
      delete process.env.GOTENBERG_URL;
    } else {
      process.env.GOTENBERG_URL = originalGotenberg;
    }
  });

  it("reports a clear error when GOTENBERG_URL is unset", async () => {
    delete process.env.GOTENBERG_URL;
    const docx = renderContractLooDocx(createContractLooFixture());
    await expect(convertDocxToPdf(docx)).rejects.toMatchObject({
      name: "DocxToPdfError",
      code: "GOTENBERG_MISSING",
    } satisfies Partial<DocxToPdfError>);
  });

  it("converts via Gotenberg when GOTENBERG_URL is set and the service is up", async () => {
    if (!resolveGotenbergUrl()) {
      return;
    }
    const docx = renderContractLooDocx(createContractLooFixture());
    try {
      const pdf = await convertDocxToPdf(docx);
      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(1000);
      expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") {
        return; // configured but container not running in this env
      }
      throw err;
    }
  }, 120_000);
});
