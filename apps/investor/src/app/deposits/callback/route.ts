import { NextRequest, NextResponse } from "next/server";

function resolveReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/transactions";
  }
  return value;
}

function buildReturnRedirect(depositId: string | null, returnTo: string) {
  const redirectUrl = new URL(returnTo, "https://cashsouk.local");
  if (depositId) {
    redirectUrl.searchParams.set("depositReturn", depositId);
  }

  const location = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location },
  });
}

/** Curlec posts here after FPX; we send the user back with a query param for the status modal. */
export async function POST(request: NextRequest) {
  const depositId = request.nextUrl.searchParams.get("depositId");
  const returnTo = resolveReturnTo(request.nextUrl.searchParams.get("returnTo"));

  // Payment verification is handled by webhooks; this route only resumes the in-app UX.
  await request.formData();

  return buildReturnRedirect(depositId, returnTo);
}

/** Curlec may redirect here via GET when the customer cancels or returns without a POST body. */
export async function GET(request: NextRequest) {
  const depositId = request.nextUrl.searchParams.get("depositId");
  const returnTo = resolveReturnTo(request.nextUrl.searchParams.get("returnTo"));
  return buildReturnRedirect(depositId, returnTo);
}
