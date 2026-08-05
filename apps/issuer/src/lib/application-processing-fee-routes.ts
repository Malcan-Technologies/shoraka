/** Default return path after Curlec FPX callback for application processing fee. */
export function buildApplicationEditReturnTo(applicationId: string): string {
  return `/applications/${applicationId}/edit?continue=processingFee`;
}

/**
 * Parse application id from edit-wizard paths.
 * Supports new `/applications/{id}/edit` and legacy `/applications/edit/{id}`.
 */
export function parseApplicationIdFromEditPath(pathname: string): string | null {
  return (
    pathname.match(/^\/applications\/([^/]+)\/edit\/?$/)?.[1] ??
    pathname.match(/^\/applications\/edit\/([^/]+)\/?$/)?.[1] ??
    null
  );
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
    ? `/applications/${applicationId}/edit?${query}`
    : `/applications/${applicationId}/edit?step=${step}`;
}
