import fs from "node:fs";
import path from "node:path";
import { resolveOfferRespondedByLabel } from "./offer-responded-by";

const viewSource = fs.readFileSync(
  path.join(__dirname, "../components/contract-detail-view.tsx"),
  "utf8"
);

describe("resolveOfferRespondedByLabel", () => {
  it("prefers the named respondent", () => {
    expect(resolveOfferRespondedByLabel("Aisha Rahman", "2026-09-01T00:00:00.000Z")).toBe(
      "Aisha Rahman"
    );
  });

  it("falls back to signing-package copy when only responded_at is present", () => {
    expect(resolveOfferRespondedByLabel(null, "2026-09-01T00:00:00.000Z")).toBe(
      "Accepted via signing package"
    );
    expect(resolveOfferRespondedByLabel(undefined, "2026-09-01T00:00:00.000Z")).toBe(
      "Accepted via signing package"
    );
  });

  it("keeps No response yet when neither name nor responded_at exists", () => {
    expect(resolveOfferRespondedByLabel(null, null)).toBe("No response yet");
    expect(resolveOfferRespondedByLabel(undefined, undefined)).toBe("No response yet");
  });

  it("is the Responded by value on the contract detail view", () => {
    expect(viewSource).toContain('label="Responded by"');
    expect(viewSource).toContain("resolveOfferRespondedByLabel(");
    expect(viewSource).toContain("data.offerRespondedByUserName");
    expect(viewSource).toContain("data.offerDetails?.responded_at");
  });
});
