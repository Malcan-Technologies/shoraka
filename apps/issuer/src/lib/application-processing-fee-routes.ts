/** Default return path after Curlec FPX callback for application processing fee. */
export function buildApplicationEditReturnTo(applicationId: string): string {
  return `/applications/edit/${applicationId}?continue=processingFee`;
}

/** Step navigation that keeps FPX return params (processingFeeReturn, continue, etc.). */
export function buildEditApplicationStepUrl(
  applicationId: string,
  step: number,
  preserveFrom?: URLSearchParams | string
): string {
  const params = new URLSearchParams(
    preserveFrom instanceof URLSearchParams ? preserveFrom.toString() : preserveFrom ?? ""
  );
  params.set("step", String(step));
  const query = params.toString();
  return query
    ? `/applications/edit/${applicationId}?${query}`
    : `/applications/edit/${applicationId}?step=${step}`;
}
