"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

const INVESTOR_URL = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3002";
const ISSUER_URL = process.env.NEXT_PUBLIC_ISSUER_URL || "http://localhost:3001";
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3003";

function CallbackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const onboarding = searchParams.get("onboarding");
  const role = searchParams.get("role");

  useEffect(() => {
    if (!token) {
      router.push("/");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // Prioritize role from query param (set by backend) over JWT payload
      // This ensures correct redirect when user doesn't have the role yet
      // Normalize role to uppercase string for comparison
      const activeRole = (role || payload.activeRole || "INVESTOR").toString().toUpperCase();

      // Don't store tokens here - landing page just redirects to portals
      // Each portal's callback page will handle token storage in memory
      // refresh_token is stored in HTTP-only cookie by backend

      let redirectUrl = "";

      // Always redirect to portal's callback page first to store token in memory
      // Then portal callback will redirect to the appropriate destination
        if (activeRole === "INVESTOR") {
        redirectUrl = `${INVESTOR_URL}/callback`;
        } else if (activeRole === "ISSUER") {
        redirectUrl = `${ISSUER_URL}/callback`;
        } else if (activeRole === "ADMIN") {
        redirectUrl = `${ADMIN_URL}/callback`;
      }

      if (redirectUrl) {
        // Pass token and onboarding status to portal callback page
        const finalUrl = `${redirectUrl}?token=${encodeURIComponent(token)}${onboarding ? `&onboarding=${onboarding}` : ""}`;
        // Use window.location.replace to avoid adding to history and ensure redirect happens
        // This prevents back button from returning to callback with expired state
        window.location.replace(finalUrl);
      } else {
        // Clean URL and redirect to home
        window.history.replaceState(null, "", window.location.pathname);
        router.push("/");
      }
    } catch (error) {
      // Clean URL on error and redirect to home
      window.history.replaceState(null, "", window.location.pathname);
      router.push("/");
    }
  }, [token, onboarding, role, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <CallbackPageContent />
    </Suspense>
  );
}

