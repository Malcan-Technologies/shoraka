"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Logo,
} from "@cashsouk/ui";
import { ArrowRightIcon, ArrowRightEndOnRectangleIcon } from "@heroicons/react/24/outline";
import { getAuthToken, redirectToLanding } from "../../lib/auth";
import { createApiClient } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function OnboardingStartPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    // Flag to prevent duplicate API calls in Strict Mode
    let isMounted = true;
    
    // Get token from query params or localStorage
    const token = getAuthToken();
    
    if (!token) {
      if (isMounted) {
        redirectToLanding();
      }
      return;
    }

    const fetchUser = async () => {
      const authToken = getAuthToken();
      if (!authToken) {
        setLoading(false);
        return;
      }

      try {
        const apiClient = createApiClient(API_URL);
        
        // Fetch user info
        const userResult = await apiClient.get<{
          user: {
            first_name: string;
            last_name: string;
          };
          activeRole: string | null;
          sessions: {
            active: number;
          };
        }>("/v1/auth/me");
        
        if (userResult.success && userResult.data) {
          if (isMounted) {
            setUser({
              firstName: userResult.data.user.first_name || "",
              lastName: userResult.data.user.last_name || "",
            });
          }
        }

        // Log onboarding start - only if mounted
        if (isMounted) {
          await apiClient.post("/v1/auth/start-onboarding", {
            role: "ISSUER",
          });
        }
      } catch (error) {
        console.error("Failed to fetch user or log onboarding:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUser();
    
    // Cleanup to prevent duplicate calls
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleStartOnboarding = async () => {
    const token = getAuthToken();
    
    if (!token) {
      redirectToLanding();
      return;
    }

    setCompleting(true);

    try {
      const apiClient = createApiClient(API_URL);
      const result = await apiClient.post("/v1/auth/complete-onboarding", {
        role: "ISSUER",
      });

      if (result.success) {
        const authToken = getAuthToken();
        if (authToken) {
          router.push(`/?token=${encodeURIComponent(authToken)}`);
        } else {
          router.push("/");
        }
      } else {
        console.error("Failed to complete onboarding:", result);
        setCompleting(false);
      }
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      setCompleting(false);
    }
  };

  const handleLogout = () => {
    const token = getAuthToken();
    const logoutUrl = new URL(`${API_URL}/v1/auth/cognito/logout`);
    if (token) {
      logoutUrl.searchParams.set("token", token);
    }
    // Clear tokens from localStorage before redirecting
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    window.location.href = logoutUrl.toString();
  };

  // Check for token - but only redirect if we're sure there's no token
  // (don't redirect during initial load when token might be in URL)
  const token = getAuthToken();
  if (!token && !loading && typeof window !== "undefined") {
    // Only redirect if we've finished loading and still have no token
    // This prevents redirecting when token is in URL but not yet extracted
    const urlParams = new URLSearchParams(window.location.search);
    const tokenInUrl = urlParams.get("token");
    if (!tokenInUrl) {
      redirectToLanding();
      return null;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : "there";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {/* Main Card */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="text-center space-y-2 pb-4">
            <CardTitle className="text-2xl font-bold">Welcome {displayName}</CardTitle>
            <CardDescription className="text-[15px] leading-7">
              Let's set up your <strong>Issuer</strong> account to start listing financing
              opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Button
              variant="action"
              className="w-full h-11 text-[15px]"
              onClick={handleStartOnboarding}
              disabled={completing}
            >
              <span>{completing ? "Completing..." : "Start Onboarding"}</span>
              {!completing && <ArrowRightIcon className="h-4 w-4 ml-2" />}
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full h-11 text-[15px] hover:bg-transparent hover:text-primary"
              onClick={handleLogout}
            >
              <ArrowRightEndOnRectangleIcon className="h-4 w-4 mr-2" />
              <span>Logout</span>
            </Button>

            <p className="text-xs text-center text-muted-foreground pt-2">
              Complete your onboarding to access your issuer dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
