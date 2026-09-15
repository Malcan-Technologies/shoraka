import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("OfferReviewPanel signing package states", () => {
  const source = readFileSync(join(__dirname, "OfferReviewPanel.tsx"), "utf8");

  it("explains preparing and failed send phases to the issuer", () => {
    expect(source).toContain("send_in_progress");
    expect(source).toContain("send_phase === \"FAILED\"");
    expect(source).toContain("The signing package is being prepared.");
    expect(source).toContain("Invitation emails are being sent.");
    expect(source).toContain("CashSouk can retry delivery from the admin portal.");
  });
});
