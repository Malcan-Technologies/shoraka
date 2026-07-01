import { NextRequest, NextResponse } from "next/server";

function resolveReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function buildReturnRedirect(processingFeeId: string | null, returnTo: string) {
  const redirectUrl = new URL(returnTo, "https://cashsouk.local");
  if (processingFeeId) {
    redirectUrl.searchParams.set("processingFeeReturn", processingFeeId);
  }

  const location = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location },
  });
}

/** Curlec posts here after FPX; we send the user back with a query param for the status modal. */
export async function POST(request: NextRequest) {
  const processingFeeId = request.nextUrl.searchParams.get("processingFeeId");
  const returnTo = resolveReturnTo(request.nextUrl.searchParams.get("returnTo"));

  await request.formData();

  return buildReturnRedirect(processingFeeId, returnTo);
}

export async function GET(request: NextRequest) {
  const processingFeeId = request.nextUrl.searchParams.get("processingFeeId");
  const returnTo = resolveReturnTo(request.nextUrl.searchParams.get("returnTo"));
  return buildReturnRedirect(processingFeeId, returnTo);
}
