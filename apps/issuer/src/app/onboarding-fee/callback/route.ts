import { NextRequest, NextResponse } from "next/server";

function resolveReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/onboarding-start";
  }
  return value;
}

function buildReturnRedirect(onboardingFeeId: string | null, returnTo: string) {
  const redirectUrl = new URL(returnTo, "https://cashsouk.local");
  if (onboardingFeeId) {
    redirectUrl.searchParams.set("onboardingFeeReturn", onboardingFeeId);
  }

  const location = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location },
  });
}

/** Curlec posts here after FPX; we send the user back with a query param for the status modal. */
export async function POST(request: NextRequest) {
  const onboardingFeeId = request.nextUrl.searchParams.get("onboardingFeeId");
  const returnTo = resolveReturnTo(request.nextUrl.searchParams.get("returnTo"));

  await request.formData();

  return buildReturnRedirect(onboardingFeeId, returnTo);
}

export async function GET(request: NextRequest) {
  const onboardingFeeId = request.nextUrl.searchParams.get("onboardingFeeId");
  const returnTo = resolveReturnTo(request.nextUrl.searchParams.get("returnTo"));
  return buildReturnRedirect(onboardingFeeId, returnTo);
}
