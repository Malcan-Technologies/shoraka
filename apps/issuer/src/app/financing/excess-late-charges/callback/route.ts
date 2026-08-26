import { NextRequest, NextResponse } from "next/server";
import {
  buildExcessLateChargeReturnLocation,
  resolveExcessLateChargeReturnTo,
  sanitizeExcessLateChargePaymentId,
} from "@/lib/excess-late-charge-payment-routes";

function buildReturnRedirect(paymentId: string | null, returnTo: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: buildExcessLateChargeReturnLocation(paymentId, returnTo) },
  });
}

function readCallbackParams(request: NextRequest) {
  return {
    paymentId: sanitizeExcessLateChargePaymentId(
      request.nextUrl.searchParams.get("excessLateChargeId")
    ),
    returnTo: resolveExcessLateChargeReturnTo(request.nextUrl.searchParams.get("returnTo")),
  };
}

export async function POST(request: NextRequest) {
  const { paymentId, returnTo } = readCallbackParams(request);
  await request.formData();
  return buildReturnRedirect(paymentId, returnTo);
}

export async function GET(request: NextRequest) {
  const { paymentId, returnTo } = readCallbackParams(request);
  return buildReturnRedirect(paymentId, returnTo);
}
