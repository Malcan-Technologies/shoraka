import * as fs from "fs";
import * as path from "path";
import { PROCESSING_FEE_CONFIRMING_COPY } from "@/lib/application-processing-fee-confirmation";

describe("application processing fee confirming surface", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "application-processing-fee-step.tsx"),
    "utf8"
  );

  it("exposes accessible status text for the spinner-only confirming state", () => {
    expect(source).toContain('role="status"');
    expect(source).toContain("sr-only");
    expect(source).toContain("PROCESSING_FEE_CONFIRMING_COPY.title");
    expect(PROCESSING_FEE_CONFIRMING_COPY.title).toMatch(/confirming your payment/i);
  });

  it("polls saved fee detail instead of create/load while awaiting confirmation", () => {
    expect(source).toContain("useApplicationProcessingFeeQuery");
    expect(source).toContain("resolvePendingProcessingFeeResumeFeeId");
    expect(source).toContain("!resumeFeeId &&");
  });
});
