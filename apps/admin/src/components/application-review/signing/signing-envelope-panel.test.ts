import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin signing envelope panel", () => {
  const source = readFileSync(join(__dirname, "signing-envelope-panel.tsx"), "utf8");

  it("shows every readiness issue and persisted send failures", () => {
    expect(source).toContain("useRetrySigningEnvelopeDelivery");
    expect(source).toContain("Retry delivery");
    expect(source).toContain("issues.map");
    expect(source).toContain("send_phase");
    expect(source).toContain("PREPARING");
    expect(source).toContain("DELIVERING");
  });
});
