import { getTrusteeRegenerateCopy } from "./trustee-letter-regenerate";

describe("getTrusteeRegenerateCopy", () => {
  it("explains that regenerate reloads platform settings before trustee submit", () => {
    expect(getTrusteeRegenerateCopy()).toEqual({
      button: "Regenerate Letter",
      confirmLabel: "Regenerate Letter",
      confirmTitle: "Regenerate trustee letter?",
      description:
        "Replace the current PDF with a new letter using the latest Trustee Letter and Money Flow Account settings. Review the new file before submitting it to the trustee.",
      success: "Trustee letter regenerated",
    });
  });
});
