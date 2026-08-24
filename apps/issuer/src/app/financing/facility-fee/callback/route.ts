import { NextRequest, NextResponse } from "next/server";
import {
  buildFacilityFeeReturnLocation,
  resolveFacilityFeeReturnTo,
  sanitizeFacilityFeePaymentId,
} from "@/lib/facility-fee-payment-routes";

function buildReturnRedirect(paymentId: string | null, returnTo: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: buildFacilityFeeReturnLocation(paymentId, returnTo) },
  });
}

function readCallbackParams(request: NextRequest) {
  return {
    paymentId: sanitizeFacilityFeePaymentId(request.nextUrl.searchParams.get("facilityFeeId")),
    returnTo: resolveFacilityFeeReturnTo(request.nextUrl.searchParams.get("returnTo")),
  };
}

/** Curlec posts here after FPX; we send the issuer back with a query param for the status dialog. */
export async function POST(request: NextRequest) {
  const { paymentId, returnTo } = readCallbackParams(request);
  await request.formData();
  return buildReturnRedirect(paymentId, returnTo);
}

export async function GET(request: NextRequest) {
  const { paymentId, returnTo } = readCallbackParams(request);
  return buildReturnRedirect(paymentId, returnTo);
}
