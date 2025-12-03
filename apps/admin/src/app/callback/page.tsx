"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

function CallbackPageContent() {
  const searchParams = useSearchParams();
  const processedRef = useRef(false);
  const redirectingRef = useRef(false);
  const token = searchParams.get("token");
  const refreshToken = searchParams.get("refresh_token");
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
      window.location.href = "/";
      return;
    }

    try {
      // Store tokens in localStorage
      localStorage.setItem("auth_token", token);
      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }

      // Set redirecting flag before redirect
      redirectingRef.current = true;

      // Remove token from URL to prevent infinite reloads
      // Use window.location.replace to ensure clean redirect without query params
      const cleanUrl = onboarding === "required" ? "/welcome" : "/";
      window.location.replace(cleanUrl);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[Admin Callback] Error processing callback:", error);
      redirectingRef.current = true;
      window.location.replace("/");
    }
  }, [token, refreshToken, onboarding]);

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

