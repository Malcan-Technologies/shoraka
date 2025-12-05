"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function CallbackPageContent() {
  const searchParams = useSearchParams();
  const { setAccessToken } = useAuthToken();
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (processedRef.current) {
      return;
    }

    const token = searchParams.get("token");
    const onboarding = searchParams.get("onboarding");

    // Case 1: Token in URL (OAuth callback flow)
    if (token) {
      processedRef.current = true;
      try {
        // Store access token in memory (Auth Context)
        setAccessToken(token);

        // Redirect based on onboarding status using window.location for clean navigation
        if (onboarding === "required") {
          window.location.replace("/onboarding-start");
        } else {
          window.location.replace("/");
        }
      } catch (error) {
        console.error("[Issuer Callback] Error processing token:", error);
        window.location.replace("/");
      }
      return;
    }

    // Case 2: No token in URL (portal switching flow) - attempt silent refresh
    processedRef.current = true;
    const attemptSilentRefresh = async () => {
      try {
        const response = await fetch(`${API_URL}/v1/auth/silent-refresh`, {
          method: "GET",
          credentials: "include", // Include cookies (refresh_token)
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.accessToken) {
            // Store new access token in memory
            setAccessToken(data.data.accessToken);
            // Redirect to dashboard using window.location for clean navigation
            window.location.replace("/");
            return;
          }
        }

        // Silent refresh failed - redirect to login
        console.warn("[Issuer Callback] Silent refresh failed, redirecting to login");
        window.location.replace("/");
      } catch (error) {
        console.error("[Issuer Callback] Error during silent refresh:", error);
        window.location.replace("/");
      }
    };

    attemptSilentRefresh();
  }, [searchParams, setAccessToken]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
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

