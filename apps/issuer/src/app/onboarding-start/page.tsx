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
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const INVESTOR_URL = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3002";

type OnboardingStep = "welcome" | "name-input" | "account-type";

function OnboardingStartPageContent() {
  const router = useRouter();
  const { getAccessToken } = useAuthToken();
  const { isLoading: orgLoading, activeOrganization } = useOrganization();
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [nameForm, setNameForm] = useState({ firstName: "", lastName: "" });
  const [savingName, setSavingName] = useState(false);
  const [onboardingStarted, setOnboardingStarted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check organization status and redirect accordingly (except PENDING - no auto-redirect to RegTank)
  useEffect(() => {
    if (orgLoading || !activeOrganization) return;

    // If status is admin-handled pending statuses, redirect to dashboard (for terms & conditions)
    const adminHandledStatuses = ["PENDING_APPROVAL", "PENDING_AML", "PENDING_SSM_REVIEW", "PENDING_FINAL_APPROVAL"];
    const hasAdminHandledStatus = adminHandledStatuses.includes(activeOrganization.onboardingStatus) ||
      (activeOrganization.regtankOnboardingStatus && adminHandledStatuses.includes(activeOrganization.regtankOnboardingStatus));

    if (hasAdminHandledStatus) {
      router.replace("/");
      return;
    }

    // If status is REJECTED, redirect to dashboard (will show rejection message)
    if (activeOrganization.onboardingStatus === "REJECTED" || activeOrganization.regtankOnboardingStatus === "REJECTED") {
      router.replace("/");
      return;
    }
  }, [activeOrganization, orgLoading, router]);

  // Cancel onboarding when user navigates away or closes tab
  useEffect(() => {
    if (!onboardingStarted) return;

    const cancelOnboarding = async () => {
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        await apiClient.post("/v1/auth/cancel-onboarding", {
          role: "ISSUER",
          reason: "User navigated away from onboarding page",
        });
      } catch (error) {
        // Silently fail - user is leaving the page anyway
        console.error("[OnboardingStart] Failed to cancel onboarding:", error);
      }
    };

    // Handle visibility change (tab hidden/backgrounded)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Page is being hidden - cancel onboarding
        cancelOnboarding();
      }
    };

    // Handle page hide (navigation away)
    const handlePageHide = () => {
      cancelOnboarding();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    // Cleanup function - cancel onboarding when component unmounts
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      // Cancel onboarding on unmount (navigation away)
      cancelOnboarding();
    };
  }, [onboardingStarted, getAccessToken]);

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
            const firstName = userResult.data.user.first_name || "";
            const lastName = userResult.data.user.last_name || "";
            setUser({
              firstName,
              lastName,
            });
            
            // Check if names are missing
            if (!firstName.trim() || !lastName.trim()) {
              setStep("name-input");
            } else {
              // Names exist, proceed to start onboarding
              try {
                await apiClient.post("/v1/auth/start-onboarding", {
                  role: "ISSUER",
                });
                if (isMounted) {
                  setOnboardingStarted(true);
                }
              } catch (error: any) {
                // If backend also rejects due to missing names, show name input
                if (error?.response?.data?.error === "NAMES_REQUIRED") {
                  setStep("name-input");
                }
              }
            }
          }
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

  const handleStartOnboarding = async () => {
    // Check if names are missing before proceeding
    if (!user?.firstName?.trim() || !user?.lastName?.trim()) {
      setStep("name-input");
      return;
    }
    
    // Try to start onboarding - backend will validate names
    try {
      const apiClient = createApiClient(API_URL, getAccessToken);
      await apiClient.post("/v1/auth/start-onboarding", {
        role: "ISSUER",
      });
      setOnboardingStarted(true);
      setStep("account-type");
    } catch (error: any) {
      if (error?.response?.data?.error === "NAMES_REQUIRED") {
        setStep("name-input");
      } else {
        console.error("Failed to start onboarding:", error);
      }
    }
  };

  const handleSaveName = async () => {
    if (!nameForm.firstName.trim() || !nameForm.lastName.trim()) {
      return;
    }

    setSavingName(true);
    try {
      const apiClient = createApiClient(API_URL, getAccessToken);
      await apiClient.patch("/v1/auth/profile", {
        firstName: nameForm.firstName.trim(),
        lastName: nameForm.lastName.trim(),
      });

      // Update local user state
      setUser({
        firstName: nameForm.firstName.trim(),
        lastName: nameForm.lastName.trim(),
      });

      // Now proceed to start onboarding
      await apiClient.post("/v1/auth/start-onboarding", {
        role: "ISSUER",
      });

      setOnboardingStarted(true);
      setStep("account-type");
    } catch (error) {
      console.error("Failed to save name:", error);
    } finally {
      setSavingName(false);
    }
  };

  const handleBackToWelcome = () => {
    setStep("welcome");
  };

  const handleSwitchPortal = () => {
    window.location.href = INVESTOR_URL;
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
                  Let&apos;s set up your <strong>Issuer</strong> account to start listing financing
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
                  <span>Switch to Investor Portal</span>
                </Button>

                <p className="text-xs text-center text-muted-foreground pt-2">
                  Complete your onboarding to access your issuer dashboard
                </p>
              </CardContent>
            </Card>
          )}

          {step === "name-input" && (
            <Card className="rounded-2xl shadow-lg w-full">
              <CardHeader className="text-center space-y-2 pb-4">
                <CardTitle className="text-2xl font-bold">Enter Your Name</CardTitle>
                <CardDescription className="text-[15px] leading-7">
                  We need your first and last name to proceed with onboarding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={nameForm.firstName}
                    onChange={(e) => setNameForm({ ...nameForm, firstName: e.target.value })}
                    placeholder="Enter your first name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={nameForm.lastName}
                    onChange={(e) => setNameForm({ ...nameForm, lastName: e.target.value })}
                    placeholder="Enter your last name"
                    className="h-11"
                  />
                </div>
                <Button
                  variant="action"
                  className="w-full h-11 text-[15px]"
                  onClick={handleSaveName}
                  disabled={savingName || !nameForm.firstName.trim() || !nameForm.lastName.trim()}
                >
                  {savingName ? "Saving..." : "Continue"}
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-11 text-[15px]"
                  onClick={handleBackToWelcome}
                  disabled={savingName}
                >
                  Back
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "account-type" && (
            <AccountTypeSelector
              onBack={handleBackToWelcome}
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
