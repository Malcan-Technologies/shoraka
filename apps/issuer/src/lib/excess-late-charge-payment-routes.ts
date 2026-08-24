const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const NOTE_PATH_PATTERN = /^\/financing\/notes\/[^/]+$/;

export const EXCESS_LATE_CHARGE_RETURN_QUERY = "excessLateChargeReturn";
export const EXCESS_LATE_CHARGE_PAYMENT_ID_PARAM = "excessLateChargeId";

export function buildExcessLateChargeNoteReturnTo(noteId: string): string {
  return `/financing/notes/${noteId}`;
}

export function parseNoteIdFromFinancingPath(pathname: string): string | null {
  return pathname.match(/^\/financing\/notes\/([^/]+)\/?$/)?.[1] ?? null;
}

export function sanitizeExcessLateChargePaymentId(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return PAYMENT_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function resolveExcessLateChargeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/financing";
  }

  try {
    const parsed = new URL(value, "https://cashsouk.local");
    if (!NOTE_PATH_PATTERN.test(parsed.pathname)) {
      return "/financing";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/financing";
  }
}

export function buildExcessLateChargeReturnLocation(
  paymentId: string | null,
  returnTo: string
): string {
  const redirectUrl = new URL(returnTo, "https://cashsouk.local");
  if (paymentId) {
    redirectUrl.searchParams.set(EXCESS_LATE_CHARGE_RETURN_QUERY, paymentId);
  }
  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
}
