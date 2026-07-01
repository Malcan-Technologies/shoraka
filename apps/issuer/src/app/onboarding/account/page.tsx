"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  InfoTooltip,
  Logo,
  Skeleton,
  useHeader,
} from "@cashsouk/ui";
import { ArrowRightIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import { redirectToLanding } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountTypeSelector } from "@/components/account-type-selector";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const INVESTOR_URL = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3002";

type OnboardingStep = "welcome" | "name-input" | "account-type";

function OnboardingAccountPageContent() {
  const { setTitle } = useHeader();
  const { getAccessToken } = useAuthToken();

  useEffect(() => {
    setTitle("Onboarding");
  }, [setTitle]);
  const { isLoading: orgLoading } = useOrganization();
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [nameForm, setNameForm] = useState({ firstName: "", lastName: "" });
  const [savingName, setSavingName] = useState(false);

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
          user: { first_name: string; last_name: string };
        }>("/v1/auth/me");

        if (userResult.success && userResult.data) {
          const firstName = userResult.data.user.first_name || "";
          const lastName = userResult.data.user.last_name || "";

          if (isMounted) {
            setUser({ firstName, lastName });
            if (!firstName.trim() || !lastName.trim()) {
              setNameForm({ firstName, lastName });
              setStep("name-input");
            }
          }
        }
      } catch (error) {
        console.error("[OnboardingAccount] Failed to fetch user:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchUser();
    return () => {
      isMounted = false;
    };
  }, [getAccessToken]);

  const handleStartOnboarding = () => {
    if (!user?.firstName?.trim() || !user?.lastName?.trim()) {
      setStep("name-input");
      return;
    }
    setStep("account-type");
  };

  const handleSaveName = async () => {
    if (!nameForm.firstName.trim() || !nameForm.lastName.trim()) return;

    setSavingName(true);
    try {
      const apiClient = createApiClient(API_URL, getAccessToken);
      await apiClient.patch("/v1/auth/profile", {
        firstName: nameForm.firstName.trim(),
        lastName: nameForm.lastName.trim(),
      });
      setUser({
        firstName: nameForm.firstName.trim(),
        lastName: nameForm.lastName.trim(),
      });
      setStep("account-type");
    } catch (error) {
      console.error("[OnboardingAccount] Failed to save name:", error);
    } finally {
      setSavingName(false);
    }
  };

  if (loading || orgLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md space-y-8">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : "there";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md flex flex-col items-center space-y-8">
        <Logo />

        {step === "welcome" && (
          <Card className="rounded-2xl shadow-lg w-full">
            <CardHeader className="text-center space-y-2 pb-4">
              <CardTitle className="text-2xl font-bold">Welcome {displayName}</CardTitle>
              <CardDescription className="text-[15px] leading-7">
                Let&apos;s set up your <strong>Issuer</strong> account to start applying for
                financing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <Button variant="action" className="w-full h-11 text-[15px]" onClick={handleStartOnboarding}>
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
                onClick={() => {
                  window.location.href = INVESTOR_URL;
                }}
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
              <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                Enter Your Name
                <InfoTooltip
                  className="max-w-[320px]"
                  content={<p className="text-sm">Use the name as it appears on your IC.</p>}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={nameForm.firstName}
                  onChange={(e) => setNameForm({ ...nameForm, firstName: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={nameForm.lastName}
                  onChange={(e) => setNameForm({ ...nameForm, lastName: e.target.value })}
                  className="h-11"
                />
              </div>
              <Button
                variant="action"
                className="w-full h-11"
                onClick={() => void handleSaveName()}
                disabled={savingName || !nameForm.firstName.trim() || !nameForm.lastName.trim()}
              >
                {savingName ? "Saving..." : "Continue"}
              </Button>
              <Button variant="ghost" className="w-full h-11" onClick={() => setStep("welcome")}>
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "account-type" && (
          <AccountTypeSelector onBack={() => setStep("welcome")} />
        )}
      </div>
    </div>
  );
}

export default function OnboardingAccountPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center">Loading...</div>}>
      <OnboardingAccountPageContent />
    </Suspense>
  );
}
