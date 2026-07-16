import { buildProspectusPage1Html } from "./prospectus-page1.html";
import { SAMPLE_PROSPECTUS_PAGE1_DATA } from "./prospectus.sample-data";
import { renderProspectusPage1Pdf } from "./render-prospectus-page1";

function isMissingChromiumRuntime(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Host system is missing dependencies/i.test(message) ||
    /libnspr4\.so/i.test(message) ||
    /shared libraries/i.test(message) ||
    /Executable doesn't exist/i.test(message) ||
    /browserType\.launch/i.test(message)
  );
}

describe("prospectus page-1 POC", () => {
  it("builds HTML containing key page-1 sections and sample note reference", () => {
    const html = buildProspectusPage1Html(SAMPLE_PROSPECTUS_PAGE1_DATA);

    expect(html).toContain(SAMPLE_PROSPECTUS_PAGE1_DATA.noteReference);
    expect(html).toContain("@page");
  });

  it(
    "renders a non-empty PDF buffer with a PDF header",
    async () => {
      let pdf: Buffer;
      try {
        pdf = await renderProspectusPage1Pdf();
      } catch (error) {
        if (isMissingChromiumRuntime(error)) {
          // Local/CI hosts without Chromium system libs should not fail the suite.
          // Docker API image already includes Chromium for this path.
          console.warn("Skipping prospectus PDF render test: Chromium runtime unavailable");
          return;
        }
        throw error;
      }

      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(1000);
      expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    },
    120_000
  );
});
