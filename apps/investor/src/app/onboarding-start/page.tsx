"use client";

import * as React from "react";
import { Suspense } from "react";
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
import { ArrowRightIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { redirectToLanding } from "../../lib/auth";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";
import { AccountTypeSelector } from "../../components/account-type-selector";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ISSUER_URL = process.env.NEXT_PUBLIC_ISSUER_URL || "http://localhost:3001";

type OnboardingStep = "welcome" | "account-type";

function OnboardingStartPageContent() {
  const router = useRouter();
  const { getAccessToken } = useAuthToken();
  const { isLoading: orgLoading } = useOrganization();
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<OnboardingStep>("welcome");

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      const token = await getAccessToken();
      
      if (!token) {
        if (isMounted) {
          setLoading(false);
          redirectToLanding();
        }
        return;
      }

      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        
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

        if (isMounted) {
          await apiClient.post("/v1/auth/start-onboarding", {
            role: "INVESTOR",
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
    
    return () => {
      isMounted = false;
    };
  }, [router, getAccessToken]);

  const handleStartOnboarding = () => {
    setStep("account-type");
  };

  const handleBackToWelcome = () => {
    setStep("welcome");
  };

  const handleOnboardingComplete = async () => {
    // The organization state is already updated locally by createOrganization and completeOnboarding
    // Use router.replace for client-side navigation to preserve React state
    // This avoids a full page reload which would cause state loss in production
    router.replace("/");
  };

  const handleSwitchPortal = () => {
    window.location.href = ISSUER_URL;
  };

  // Show loading state while fetching user data
  if (loading || orgLoading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <Skeleton className="-ml-1 h-7 w-7 rounded-md" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Skeleton className="h-6 w-28" />
        </header>
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-8">
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-lg space-y-6">
              <div className="text-center space-y-3">
                <Skeleton className="h-8 w-48 mx-auto" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </div>
              </div>
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
        <div className="w-full max-w-md flex flex-col items-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo />
          </div>

          {step === "welcome" && (
            <Card className="rounded-2xl shadow-lg w-full">
              <CardHeader className="text-center space-y-2 pb-4">
                <CardTitle className="text-2xl font-bold">Welcome {displayName}</CardTitle>
                <CardDescription className="text-[15px] leading-7">
                  Let&apos;s set up your <strong>Investor</strong> account to start exploring verified loan
                  opportunities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <Button
                  variant="action"
                  className="w-full h-11 text-[15px]"
                  onClick={handleStartOnboarding}
                >
                  <span>Start Onboarding</span>
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
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
                  <span>Switch to Issuer Portal</span>
                </Button>

                <p className="text-xs text-center text-muted-foreground pt-2">
                  Complete your onboarding to access your investor dashboard
                </p>
              </CardContent>
            </Card>
          )}

          {step === "account-type" && (
            <AccountTypeSelector
              onBack={handleBackToWelcome}
              onComplete={handleOnboardingComplete}
            />
          )}
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
