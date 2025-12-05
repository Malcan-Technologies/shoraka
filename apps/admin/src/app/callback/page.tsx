"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuthToken } from "@cashsouk/config";

function CallbackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAccessToken } = useAuthToken();
  const processedRef = useRef(false);
  const redirectingRef = useRef(false);
  const token = searchParams.get("token");
  const onboarding = searchParams.get("onboarding");

  useEffect(() => {
    // Prevent multiple executions
    if (processedRef.current) {
      return;
    }
    processedRef.current = true;

    if (!token) {
      // No token - redirect to home
      redirectingRef.current = true;
      router.push("/");
      return;
    }

    try {
      // Store access token in memory (React Context)
      // refresh_token is stored in HTTP-only cookie by backend
      setAccessToken(token);

      // Clean URL by removing token query params using replaceState
      // This prevents tokens from being exposed in browser history
      // and prevents back button from returning to callback with expired state
      window.history.replaceState(null, "", window.location.pathname);
      
      const cleanUrl = onboarding === "required" ? "/welcome" : "/";
      redirectingRef.current = true;
      router.replace(cleanUrl);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[Admin Callback] Error processing callback:", error);
      redirectingRef.current = true;
      router.replace("/");
    }
  }, [token, onboarding, router, setAccessToken]);

  // If we're redirecting, show redirecting message
  if (redirectingRef.current) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

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

