"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3003";

function CallbackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const processedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get invitation token and role from URL (for admin invitations)
  const invitationToken = searchParams.get("invitation");
  const invitationRole = searchParams.get("role");

  // Check if this is an OAuth callback (has code parameter)
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  useEffect(() => {
    // Prevent multiple executions
    if (processedRef.current) {
      return;
    }

    const handleCallback = async () => {
      try {
        console.log("[Admin Callback] Processing callback", {
          hasCode: !!code,
          hasInvitation: !!invitationToken,
          error: errorParam,
        });

        // Handle OAuth errors
        if (errorParam) {
          console.error("[Admin Callback] OAuth error:", errorParam);
          setError(`Authentication failed: ${errorParam}`);
          setLoading(false);
          setTimeout(() => router.push("/"), 3000);
          return;
        }

        // If this is an OAuth callback (has code), the backend will handle it
        // The backend OAuth callback will process the invitation token if present
        // and redirect to the landing page, which then redirects back here
        if (code) {
          console.log("[Admin Callback] OAuth code received, redirecting to backend");
          // Redirect to backend OAuth callback with invitation preserved
          const backendCallbackUrl = new URL(`${API_URL}/api/auth/callback`);
          backendCallbackUrl.searchParams.set("portal", "admin");
          if (invitationToken) {
            backendCallbackUrl.searchParams.set("invitation", invitationToken);
          }
          if (invitationRole) {
            backendCallbackUrl.searchParams.set("role", invitationRole);
          }
          // Preserve the OAuth code
          backendCallbackUrl.searchParams.set("code", code);
          // Preserve state if present
          const state = searchParams.get("state");
          if (state) {
            backendCallbackUrl.searchParams.set("state", state);
          }

          window.location.href = backendCallbackUrl.toString();
          return;
        }

        // If no code but has invitation token, redirect to backend login
        // with invitation preserved in the query parameters
        if (invitationToken && !code) {
          console.log("[Admin Callback] Invitation token found, redirecting to backend login");
          // Redirect to backend login endpoint with invitation parameters
          const loginUrl = new URL(`${API_URL}/v1/auth/cognito/login`);
          loginUrl.searchParams.set("role", "ADMIN");
          loginUrl.searchParams.set("invitation", invitationToken);
          if (invitationRole) {
            loginUrl.searchParams.set("invitation_role", invitationRole);
          }
          // Set the callback URL to preserve invitation through OAuth flow
          loginUrl.searchParams.set("callback_url", `${ADMIN_URL}/callback?invitation=${invitationToken}&role=${invitationRole || "SUPER_ADMIN"}`);
          
          window.location.href = loginUrl.toString();
          return;
        }

        // If we have a token from the backend redirect, store it and redirect to dashboard
        const token = searchParams.get("token");
        if (token) {
          console.log("[Admin Callback] Token received, redirecting to dashboard");
          // Store token temporarily (backend sets cookies, but we can use this as fallback)
          if (typeof window !== "undefined") {
            sessionStorage.setItem("admin_access_token", token);
          }
          // Clean up invitation storage
          sessionStorage.removeItem("admin_invitation_token");
          sessionStorage.removeItem("admin_invitation_role");
          
          // Redirect to dashboard
          router.push("/");
          processedRef.current = true;
          return;
        }

        // No code, no token, no invitation - just redirect to home
        console.log("[Admin Callback] No parameters, redirecting to home");
        router.push("/");
        processedRef.current = true;
      } catch (err) {
        console.error("[Admin Callback] Error:", err);
        setError("An error occurred during authentication");
        setLoading(false);
        setTimeout(() => router.push("/"), 3000);
      }
    };

    handleCallback();
  }, [code, invitationToken, invitationRole, errorParam, router, searchParams]);

  if (loading && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Processing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-destructive text-lg font-semibold">Authentication Error</div>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return null;
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

