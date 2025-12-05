"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ArrowRightIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { redirectToLanding } from "../../lib/auth";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const INVESTOR_URL = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3002";

function OnboardingStartPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, setAccessToken } = useAuthToken();
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Flag to prevent duplicate API calls in Strict Mode
    let isMounted = true;
    
    // Check for token in URL query params first (from callback redirect)
    const tokenFromQuery = searchParams.get("token");
    if (tokenFromQuery) {
      setAccessToken(tokenFromQuery);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    
    // Get token from memory
    const token = accessToken || tokenFromQuery;
    
    if (!token) {
      if (isMounted) {
        redirectToLanding();
      }
      return;
    }

    const fetchUser = async () => {
      const currentToken = accessToken || tokenFromQuery;
      if (!currentToken) {
        setLoading(false);
        return;
      }

      try {
        const apiClient = createApiClient(API_URL, () => currentToken, setAccessToken);
        
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
  }, [router, accessToken, searchParams, setAccessToken]);

  const handleStartOnboarding = async () => {
    const token = accessToken;
    
    if (!token) {
      redirectToLanding();
      return;
    }

    setCompleting(true);

    try {
      const apiClient = createApiClient(API_URL, () => token, setAccessToken);
      const result = await apiClient.post("/v1/auth/complete-onboarding", {
        role: "ISSUER",
      });

      if (result.success) {
          router.push("/");
      } else {
        console.error("Failed to complete onboarding:", result);
        setCompleting(false);
      }
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      setCompleting(false);
    }
  };

  const handleSwitchPortal = () => {
    // Simply redirect to target portal - it will auto-refresh to get access token
    window.location.href = INVESTOR_URL;
  };

  // Check for token - but only redirect if we're sure there's no token
  // (don't redirect during initial load when token might be in URL)
  if (!accessToken && !loading && typeof window !== "undefined") {
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
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <Skeleton className="-ml-1 h-7 w-7 rounded-md" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Skeleton className="h-6 w-28" />
        </header>
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
          <div className="w-full max-w-md">
            {/* Logo Skeleton */}
            <div className="flex justify-center mb-8">
              <Skeleton className="h-8 w-32" />
            </div>

            {/* Card Skeleton */}
            <div className="rounded-2xl border bg-card p-6 shadow-lg space-y-6">
              {/* Header */}
              <div className="text-center space-y-3">
                <Skeleton className="h-8 w-48 mx-auto" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-4 pt-2">
                <Skeleton className="h-11 w-full rounded-md" />
                
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <Skeleton className="h-11 w-full rounded-md" />
                
                <Skeleton className="h-3 w-48 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : "there";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        {mounted ? (
          <SidebarTrigger className="-ml-1" />
        ) : (
          <Skeleton className="-ml-1 h-7 w-7 rounded-md" />
        )}
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Onboarding</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
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
                Let&apos;s set up your <strong>Issuer</strong> account to start listing financing
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
                onClick={handleSwitchPortal}
              >
                <ArrowsRightLeftIcon className="h-4 w-4 mr-2" />
                <span>Switch to Investor Portal</span>
              </Button>

              <p className="text-xs text-center text-muted-foreground pt-2">
                Complete your onboarding to access your issuer dashboard
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function OnboardingStartPage() {
  return (
    <Suspense
      fallback={
        <>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <Skeleton className="-ml-1 h-7 w-7 rounded-md" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Skeleton className="h-6 w-28" />
          </header>
          <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </>
      }
    >
      <OnboardingStartPageContent />
    </Suspense>
  );
}
