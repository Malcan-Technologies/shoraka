"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const INVESTOR_URL = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3002";
const ISSUER_URL = process.env.NEXT_PUBLIC_ISSUER_URL || "http://localhost:3001";
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3003";

function CallbackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const processedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get portal and onboarding params (set by backend redirect)
  const portalParam = searchParams.get("portal");
  const onboardingParam = searchParams.get("onboarding");

  useEffect(() => {
    // Prevent multiple executions
    if (processedRef.current) {
      return;
    }

    const handleCallback = async () => {
      try {
        console.log("[Landing Callback] Starting OAuth callback processing");
        
        // Read the access token directly from cookies set by the backend
        const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
        if (!clientId) {
          console.error("[Landing Callback] COGNITO_CLIENT_ID not configured");
          setError("Configuration error. Please contact support.");
          setTimeout(() => router.push("/"), 2000);
          return;
        }

        // Get all cookies
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

        // Find the LastAuthUser cookie to get the cognito user ID
        const lastAuthUserKey = `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`;
        const cognitoUserId = cookies[lastAuthUserKey];

        if (!cognitoUserId) {
          console.error("[Landing Callback] LastAuthUser cookie not found", { cookies: Object.keys(cookies) });
          setError("Authentication session not found. Please try again.");
          setTimeout(() => router.push("/"), 2000);
          return;
        }

        // Get the access token for this user
        const accessTokenKey = `CognitoIdentityServiceProvider.${clientId}.${cognitoUserId}.accessToken`;
        const accessTokenValue = cookies[accessTokenKey];

        if (!accessTokenValue) {
          console.error("[Landing Callback] Access token cookie not found", { cognitoUserId, accessTokenKey });
          setError("Access token not found. Please try again.");
          setTimeout(() => router.push("/"), 2000);
          return;
        }

        console.log("[Landing Callback] Access token retrieved from cookie successfully");
        processedRef.current = true;

        // Use portal parameter from backend (based on requestedRole)
        // This tells us which portal the user originally tried to access
        let targetPortal = portalParam?.toLowerCase();
        
        // Fallback to localStorage if portal param not found
        if (!targetPortal && typeof window !== "undefined") {
          targetPortal = localStorage.getItem("requested_portal") || "investor";
          localStorage.removeItem("requested_portal"); // Clean up
        }
        
        const onboarding = onboardingParam === "required";

        console.info("[Landing Callback] Processing redirect", {
          targetPortal,
          onboarding,
          portalParam,
          onboardingParam,
        });

        // SIMPLIFIED REDIRECT LOGIC
        // The target portal already has its own authentication checks (useAuth hooks)
        // that will verify roles and redirect if necessary.
        // We just need to route the user to the correct portal.

        if (targetPortal === "admin") {
          // Redirect to admin portal - the admin useAuth hook will verify ADMIN role
          console.info("[Landing Callback] Redirecting to admin portal");
          window.location.replace(ADMIN_URL);
          return;
        }

        if (targetPortal === "investor") {
          // Redirect based on onboarding status
          const investorDestination = onboarding ? "/onboarding-start" : "/";
          console.info("[Landing Callback] Redirecting to investor portal:", investorDestination);
          window.location.replace(`${INVESTOR_URL}${investorDestination}`);
          return;
        }

        if (targetPortal === "issuer") {
          // Redirect based on onboarding status
          const issuerDestination = onboarding ? "/onboarding-start" : "/";
          console.info("[Landing Callback] Redirecting to issuer portal:", issuerDestination);
          window.location.replace(`${ISSUER_URL}${issuerDestination}`);
          return;
        }

        // Fallback: No valid portal detected or landing portal selected
        console.info("[Landing Callback] No specific portal or landing portal selected, staying on landing");
        router.push("/");
      } catch (error) {
        console.error("[Landing Callback] Error processing callback:", error);
        // Clean URL on error and redirect to home
        window.history.replaceState(null, "", window.location.pathname);
        router.push("/");
      }
    };

    handleCallback();
  }, [portalParam, onboardingParam, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">
          {error || "Completing authentication..."}
        </p>
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

