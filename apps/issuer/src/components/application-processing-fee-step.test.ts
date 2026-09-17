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
    expect(source).toContain("shouldLoadProcessingFeeOrder(resumeFeeId)");
    expect(source).toContain("!resumeFeeId &&");
  });

  it("create/loads a live order after retry instead of paying the submit snapshot", () => {
    expect(source).toContain("shouldLoadProcessingFeeOrder(resumeFeeId)");
    expect(source).toContain("resolveProcessingFeeCheckoutOrder");
    expect(source).toContain("isProcessingFeePayBlockedOnLiveOrder");
    expect(source).toContain("isProcessingFeeAmountLoading");
    expect(source).toContain("feeOrderQuery.refetch()");
    expect(source).not.toContain(
      "!resumeFeeId && (!initialFee || awaitingConfirmation || initialFee?.status === \"PAID\")"
    );
    expect(source).not.toContain(
      "isLoadingAmount = !initialFee && feeOrderQuery.isLoading"
    );
    expect(source).not.toMatch(
      /openCurlecFpxCheckout\(\{[\s\S]*resolvedFee\.(curlecKeyId|curlecOrderId)/
    );
  });

  it("marks a launched checkout as awaiting confirmation", () => {
    expect(source).toContain("markProcessingFeeAwaitingConfirmation");
    expect(source).toContain("releaseAbandonedProcessingFeeCheckout");
    expect(source).not.toContain("awaitingConfirmation: false");
  });

  it("releases awaiting confirmation on checkout dismiss, not only thrown errors", () => {
    expect(source).toMatch(
      /onDismiss:\s*\(\)\s*=>\s*\{[\s\S]*persistReleasedAbandonedCheckout\(markedFeeId\)/
    );
    expect(source).toMatch(
      /catch\s*\(err\)\s*\{[\s\S]*persistReleasedAbandonedCheckout\(markedFeeId\)/
    );
    expect(source).not.toMatch(/onDismiss:\s*\(\)\s*=>\s*setIsOpeningCheckout\(false\)/);
  });

  it("restores the pay step for continue=processingFee and overlays only on processingFeeReturn", () => {
    const page = fs.readFileSync(
      path.join(
        __dirname,
        "../app/(application-flow)/applications/[id]/edit/page.tsx"
      ),
      "utf8"
    );
    expect(page).toContain('searchParams.get("continue") === "processingFee" && requiresProcessingFee');
    expect(page).toContain("setShowProcessingFeeStep(true)");
    expect(page).toMatch(
      /isPostFeeReturnFlow \?\s*\(\s*\n\s*<ApplicationFlowBlockedStepSkeleton/
    );
    expect(page).not.toMatch(
      /isProcessingFeeFlow \?\s*\(\s*\n\s*<ApplicationFlowBlockedStepSkeleton/
    );
  });
});
