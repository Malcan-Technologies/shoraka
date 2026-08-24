"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Shared issuer fee UI when a captured payment is held for verification. */
export function PaymentUnderReviewNotice({
  title = "Payment received and under review",
  description = "We received a payment notification, but some payment details require verification. You do not need to make another payment. Our team will review it.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Alert variant="attention" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-primary/40 bg-primary/5 text-primary font-normal"
        >
          Under review
        </Badge>
      </div>
      <div className="flex items-start gap-3">
        <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-1">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>
            <p>{description}</p>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

export function isIssuerFeeCaptureMismatchHeldError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (
    code === "ONBOARDING_FEE_CAPTURE_MISMATCH_HELD" ||
    code === "PROCESSING_FEE_CAPTURE_MISMATCH_HELD" ||
    code === "FACILITY_FEE_CAPTURE_MISMATCH_HELD"
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ONBOARDING_FEE_CAPTURE_MISMATCH_HELD") ||
    message.includes("PROCESSING_FEE_CAPTURE_MISMATCH_HELD") ||
    message.includes("FACILITY_FEE_CAPTURE_MISMATCH_HELD") ||
    message.includes("under review")
  );
}
