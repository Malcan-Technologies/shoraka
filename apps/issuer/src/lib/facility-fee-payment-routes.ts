const FACILITY_FEE_PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const FACILITY_CONTRACT_PATH_PATTERN = /^\/financing\/contracts\/[^/]+$/;

export const FACILITY_FEE_RETURN_QUERY = "facilityFeeReturn";
export const FACILITY_FEE_PAYMENT_ID_PARAM = "facilityFeeId";

export function buildFacilityFeeContractReturnTo(contractId: string): string {
  return `/financing/contracts/${contractId}`;
}

export function parseContractIdFromFinancingPath(pathname: string): string | null {
  return pathname.match(/^\/financing\/contracts\/([^/]+)\/?$/)?.[1] ?? null;
}

export function sanitizeFacilityFeePaymentId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return FACILITY_FEE_PAYMENT_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** Only allow same-origin facility contract paths. Reject protocol-relative and off-route values. */
export function resolveFacilityFeeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/financing";
  }

  try {
    const parsed = new URL(value, "https://cashsouk.local");
    if (!FACILITY_CONTRACT_PATH_PATTERN.test(parsed.pathname)) {
      return "/financing";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/financing";
  }
}

export function buildFacilityFeeReturnLocation(
  paymentId: string | null,
  returnTo: string
): string {
  const redirectUrl = new URL(returnTo, "https://cashsouk.local");
  if (paymentId) {
    redirectUrl.searchParams.set(FACILITY_FEE_RETURN_QUERY, paymentId);
  }
  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
}
