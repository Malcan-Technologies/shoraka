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
    expect(source).toContain("shouldLoadProcessingFeeOrder(checkoutResumeFeeId)");
    expect(source).toContain("!resumeFeeId &&");
  });

  it("create/loads a live order after retry instead of paying the submit snapshot", () => {
    expect(source).toContain("releaseRetryableProcessingFeeConfirmation");
    expect(source).toContain("shouldLoadProcessingFeeOrder(checkoutResumeFeeId)");
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

  it("hands resumed completion to submission once and clears only this application", () => {
    expect(source).toContain("completedFeeHandoffRef");
    expect(source).toContain("handoffCompletedFee(resolvedFee.id)");
    expect(source).toContain("clearIssuerPendingSubmitAfterFee(applicationId)");
    expect(source).not.toContain("if (resumeFeeId) return");
    expect(source).not.toContain("clearIssuerPendingSubmitAfterFee()");
  });

  it("never selects a retryable terminal saved order for checkout", () => {
    expect(source).toContain(
      "const checkoutResumeFeeId = retryableResumedFee ? null : resumeFeeId"
    );
    expect(source).toContain("savedFeeQuery.data?.id === resumeFeeId");
    expect(source).toContain("resumeFeeId: checkoutResumeFeeId");
    expect(source).toMatch(
      /const liveOrder = checkoutResumeFeeId[\s\S]*feeOrderQuery\.refetch\(\)/
    );
  });

  it("marks a launched checkout as awaiting confirmation", () => {
    expect(source).toContain("markProcessingFeeAwaitingConfirmation");
    expect(source).toContain("releaseFailedProcessingFeeCheckoutLaunch");
    expect(source).not.toContain("awaitingConfirmation: false");
  });

  it("keeps confirmation on dismiss and releases it only after a launch error", () => {
    const onDismissStart = source.indexOf("onDismiss:");
    const catchStart = source.indexOf("} catch (err)", onDismissStart);
    const onDismissBlock = source.slice(onDismissStart, catchStart);
    expect(onDismissBlock).toContain("setIsOpeningCheckout(false)");
    expect(onDismissBlock).not.toContain("persistReleasedFailedCheckout");
    expect(source.slice(catchStart)).toContain(
      "persistReleasedFailedCheckout(markedFeeId)"
    );
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
