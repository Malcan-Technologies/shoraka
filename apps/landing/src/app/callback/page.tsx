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

      // Store access token
      localStorage.setItem("auth_token", token);
      
      // Store refresh token for dev mode (cookies don't work across different ports)
      const refreshToken = searchParams.get("refresh_token");
      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }

      let redirectUrl = "";

      if (onboarding === "required") {
        if (activeRole === "INVESTOR") {
          redirectUrl = `${INVESTOR_URL}/onboarding-start`;
        } else if (activeRole === "ISSUER") {
          redirectUrl = `${ISSUER_URL}/onboarding-start`;
        } else if (activeRole === "ADMIN") {
          redirectUrl = `${ADMIN_URL}/welcome`;
        }
      } else {
        if (activeRole === "INVESTOR") {
          redirectUrl = `${INVESTOR_URL}`;
        } else if (activeRole === "ISSUER") {
          redirectUrl = `${ISSUER_URL}`;
        } else if (activeRole === "ADMIN") {
          redirectUrl = `${ADMIN_URL}`;
        }
      }

      if (redirectUrl) {
        const finalUrl = `${redirectUrl}?token=${encodeURIComponent(token)}`;
        // Use window.location.replace to avoid adding to history and ensure redirect happens
        window.location.replace(finalUrl);
      } else {
        router.push("/");
      }
    } catch (error) {
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

